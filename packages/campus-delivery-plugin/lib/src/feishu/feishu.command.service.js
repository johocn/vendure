"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuCommandService = void 0;
exports.parseCommand = parseCommand;
exports.requiredRole = requiredRole;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const campus_building_entity_1 = require("../campus-building.entity");
const campus_fulfillment_config_entity_1 = require("../campus-fulfillment-config.entity");
const campus_time_1 = require("../campus-time");
const delivery_stats_service_1 = require("../delivery-stats.service");
const merchant_admin_service_1 = require("../merchant-admin.service");
const feishu_client_1 = require("./feishu.client");
const feishu_config_1 = require("./feishu.config");
const feishu_templates_1 = require("./feishu.templates");
const loggerCtx = 'Feishu';
const RATE_LIMIT_PER_MIN = 20;
const CONFIRM_TTL_MS = 5 * 60000;
const RIDER_PICK_TIMEOUT_MIN = 15;
/** 去掉 @ 占位符与首尾空白，再按首个空格切命令与参数（纯函数，便于单测） */
function parseCommand(raw) {
    const text = (raw !== null && raw !== void 0 ? raw : '')
        .replace(/@_user_\d+/g, ' ')
        .replace(/@\S+\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text)
        return { name: 'unknown' };
    const [head, ...rest] = text.split(' ');
    const arg = rest.join(' ').trim();
    if (/^(帮助|help)$/i.test(head))
        return { name: 'help' };
    if (/^(待处理|看板|board)$/i.test(head))
        return { name: 'board' };
    if (/^(今日汇总|汇总|digest)$/i.test(head))
        return { name: 'digest' };
    if (/^(异常|异常清单|超时|exceptions?)$/i.test(head))
        return { name: 'exceptions' };
    if (/^(查|订单|status)$/i.test(head))
        return { name: 'status', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^(关店|暂停营业|暂停)$/.test(head))
        return { name: 'close', store: arg ? arg.split(' ')[0] : undefined };
    if (/^(开店|恢复营业|营业)$/.test(head))
        return { name: 'open', store: arg ? arg.split(' ')[0] : undefined };
    if (/^接单$/.test(head))
        return { name: 'accept', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^出餐$/.test(head))
        return { name: 'cooking', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^确认拒单$/.test(head))
        return { name: 'confirmReject', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^拒单$/.test(head)) {
        const [orderCode, ...reasonParts] = arg.split(' ').filter(Boolean);
        return { name: 'reject', orderCode, reason: reasonParts.join(' ').trim() || undefined };
    }
    return { name: 'unknown' };
}
/** 指令所需权限等级：operator=查询/接单/出餐；owner=拒单/开关店 */
function requiredRole(cmd) {
    switch (cmd) {
        case 'help':
        case 'unknown':
            return 'none';
        case 'reject':
        case 'confirmReject':
        case 'close':
        case 'open':
            return 'owner';
        default:
            return 'operator';
    }
}
/**
 * 飞书群指令：解析 → 权限校验 → 调商家工作台服务 → 回复结果。
 * 群定位：
 * - channel：店铺群，看板/汇总/写操作都限定绑定的店铺；
 * - platform：平台管理群，看板/异常/汇总跨全部店铺，写操作按单号/店铺参数指定。
 * 鉴权：chat_id 白名单（FEISHU_CHAT_MAP）+ open_id 分 operators / owners 两级；
 * 所有操作记审计日志，回复里不出现顾客手机号/详细地址。
 */
let FeishuCommandService = class FeishuCommandService {
    constructor(cfg, client, requestContextService, connection, merchant, deliveryStats) {
        this.cfg = cfg;
        this.client = client;
        this.requestContextService = requestContextService;
        this.connection = connection;
        this.merchant = merchant;
        this.deliveryStats = deliveryStats;
        this.rate = new Map();
        this.pendingReject = new Map();
    }
    async handleMessage(input) {
        var _a;
        const { chatId, openId } = input;
        if (!this.client.enabled)
            return;
        const chat = this.cfg.chatOf(chatId);
        if (!chat) {
            core_1.Logger.warn(`未配置的群 chat_id=${chatId}，忽略指令`, loggerCtx);
            return;
        }
        if (this.isRateLimited(chatId)) {
            await this.reply(chatId, '操作过于频繁，请稍后再试。');
            return;
        }
        const cmd = parseCommand(input.text);
        const role = requiredRole(cmd.name);
        if (role === 'operator' && !this.isOperator(chat, openId)) {
            await this.audit(chatId, openId, cmd, 'denied');
            await this.reply(chatId, '无权限执行该指令（需操作员白名单）。');
            return;
        }
        if (role === 'owner' && !chat.owners.includes(openId)) {
            await this.audit(chatId, openId, cmd, 'denied-owner');
            await this.reply(chatId, '无权限执行该指令（需管理员白名单）。');
            return;
        }
        try {
            switch (cmd.name) {
                case 'help':
                    await this.reply(chatId, feishu_templates_1.HELP_TEXT);
                    break;
                case 'board':
                    await this.reply(chatId, await this.renderBoard(chat));
                    break;
                case 'digest':
                    await this.reply(chatId, await this.renderDigest(chat));
                    break;
                case 'exceptions':
                    await this.reply(chatId, await this.renderExceptions(chat));
                    break;
                case 'status':
                    await this.reply(chatId, await this.orderStatusText(cmd.orderCode));
                    break;
                case 'accept':
                    await this.accept(chat, chatId, openId, cmd);
                    break;
                case 'cooking':
                    await this.cooking(chat, chatId, openId, cmd);
                    break;
                case 'reject':
                    await this.stageReject(chatId, openId, cmd);
                    break;
                case 'confirmReject':
                    await this.confirmReject(chat, chatId, openId, cmd);
                    break;
                case 'close':
                case 'open':
                    await this.setPaused(chat, chatId, openId, cmd.name === 'close', cmd.store);
                    break;
                default:
                    await this.reply(chatId, '未识别指令，发送「帮助」查看可用指令。');
            }
        }
        catch (e) {
            const msg = (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : String(e);
            await this.audit(chatId, openId, cmd, `error:${msg}`);
            await this.reply(chatId, `执行失败：${msg}`);
        }
    }
    // ---------- 视图 ----------
    async renderBoard(chat) {
        if (chat.scope === 'platform')
            return this.platformBoardText();
        return this.channelBoardText(chat.channel, false);
    }
    async renderDigest(chat) {
        if (chat.scope === 'platform')
            return this.platformDigestText();
        return this.channelBoardText(chat.channel, true);
    }
    async renderExceptions(chat) {
        const targets = chat.scope === 'platform'
            ? await this.channelTargets()
            : [{ token: chat.channel, name: chat.channel }];
        const { exceptions, overdue } = await this.collectIssues(targets);
        return (0, feishu_templates_1.formatExceptions)(exceptions, overdue);
    }
    async platformBoardText() {
        const targets = await this.channelTargets();
        if (!targets.length)
            return '暂无已开通外卖的店铺。';
        const { exceptions, overdue } = await this.collectIssues(targets);
        const stores = [];
        for (const t of targets) {
            const ctx = await this.ctxForToken(t.token);
            const board = await this.merchant.board(ctx);
            stores.push({
                name: board.storeName || t.name,
                paused: board.paused,
                pending: board.pending.length,
                pendingCodes: board.pending.slice(0, 3).map(o => o.code),
                cooking: board.cooking.length,
                awaitingRider: board.awaitingRider.length,
                delivering: board.delivering.length,
                pendingDispatch: board.pendingDispatch.length,
                thirdParty: board.thirdParty.length,
                ownedPool: board.ownedPool.length,
                ownedDispatched: board.ownedDispatched.length,
                merchantDelivering: board.merchantDelivering.length,
                completedToday: board.completedToday,
                completedTodayAmount: board.completedTodayAmount,
                exceptionCount: exceptions.filter(t2 => t2.startsWith(`${t.name} `)).length,
            });
        }
        return (0, feishu_templates_1.formatPlatformBoard)({ stores, exceptions, overdue, at: Date.now() });
    }
    async platformDigestText() {
        const targets = await this.channelTargets();
        if (!targets.length)
            return '暂无已开通外卖的店铺。';
        const rows = [];
        let totalOrders = 0;
        let cancelled = 0;
        let completed = 0;
        let amount = 0;
        let exception = 0;
        let weighted = 0;
        let weight = 0;
        for (const t of targets) {
            const ctx = await this.ctxForToken(t.token);
            const board = await this.merchant.board(ctx);
            const stats = await this.deliveryStats.stats(ctx, 'today');
            const cancelledCount = await this.cancelledCount(ctx);
            const exceptionCount = await this.exceptionCount(ctx);
            rows.push({
                name: board.storeName || t.name,
                completed: board.completedToday,
                amount: board.completedTodayAmount,
                onTimeRate: stats.kpis.onTimeRate,
                cancelled: cancelledCount,
                exception: exceptionCount,
            });
            totalOrders += stats.kpis.totalOrders;
            cancelled += cancelledCount;
            completed += board.completedToday;
            amount += board.completedTodayAmount;
            exception += exceptionCount;
            weighted += stats.kpis.onTimeRate * stats.kpis.totalOrders;
            weight += stats.kpis.totalOrders;
        }
        return (0, feishu_templates_1.formatPlatformDigest)({
            date: (0, campus_time_1.campusDayKey)(Date.now()),
            stores: rows,
            totalOrders,
            cancelled,
            completed,
            amount,
            onTimeRate: weight ? Math.round(weighted / weight) : 0,
            exception,
        });
    }
    async channelBoardText(channelToken, withDigest) {
        const ctx = await this.ctxForToken(channelToken);
        const board = await this.merchant.board(ctx);
        if (!withDigest)
            return (0, feishu_templates_1.formatBoard)(board);
        const stats = await this.deliveryStats.stats(ctx, 'today');
        return (0, feishu_templates_1.formatDigest)(Object.assign(Object.assign({}, board), { date: (0, campus_time_1.campusDayKey)(Date.now()), totalOrders: stats.kpis.totalOrders, onTimeRate: stats.kpis.onTimeRate, cancelled: await this.cancelledCount(ctx), exceptionCount: await this.exceptionCount(ctx) }));
    }
    async orderStatusText(code) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        if (!code)
            return '用法：查 <单号>，例如「查 A1234」。';
        const order = await this.connection.rawConnection.getRepository(core_1.Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        if (!order)
            return `未找到订单：${code}`;
        const cf = order.customFields;
        let building = null;
        if (cf.buildingId) {
            const b = await this.connection.rawConnection.getRepository(campus_building_entity_1.CampusBuilding).findOne({
                where: { id: String(cf.buildingId) },
            });
            building = (_a = b === null || b === void 0 ? void 0 : b.name) !== null && _a !== void 0 ? _a : null;
        }
        let riderName = null;
        if (cf.deliveryStaffId) {
            const customer = await this.connection.rawConnection.getRepository('Customer').findOne({
                where: { id: Number(cf.deliveryStaffId) },
            });
            riderName = (_c = (_b = customer === null || customer === void 0 ? void 0 : customer.customFields) === null || _b === void 0 ? void 0 : _b.riderRealName) !== null && _c !== void 0 ? _c : null;
        }
        const reportedAt = cf.exceptionReportedAt ? new Date(cf.exceptionReportedAt).getTime() : NaN;
        return (0, feishu_templates_1.formatOrderStatus)({
            code: order.code,
            store: (_f = (_e = (_d = order.channels) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.code) !== null && _f !== void 0 ? _f : '',
            orderState: String(order.state),
            hallStatus: (_g = cf.hallStatus) !== null && _g !== void 0 ? _g : null,
            deliveryStatus: (_h = cf.deliveryStatus) !== null && _h !== void 0 ? _h : null,
            route: (_j = cf.fulfillmentRoute) !== null && _j !== void 0 ? _j : null,
            riderName,
            building,
            zone: (_k = cf.campusZone) !== null && _k !== void 0 ? _k : null,
            slotText: (_l = cf.deliverySlotText) !== null && _l !== void 0 ? _l : null,
            total: order.total,
            exceptionType: (_m = cf.exceptionType) !== null && _m !== void 0 ? _m : null,
            exceptionNote: (_o = cf.exceptionNote) !== null && _o !== void 0 ? _o : null,
            exceptionMinutes: Number.isNaN(reportedAt) ? null : Math.round((Date.now() - reportedAt) / 60000),
            createdAt: new Date(order.createdAt).getTime(),
            at: Date.now(),
        });
    }
    // ---------- 异常/超时清单 ----------
    async collectIssues(targets) {
        const exceptions = [];
        const overdue = [];
        for (const t of targets) {
            const ctx = await this.ctxForToken(t.token);
            const cfg = await this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
                where: { channelId: ctx.channelId },
            });
            if (!cfg)
                continue;
            const orders = await this.connection.getRepository(ctx, core_1.Order).createQueryBuilder('order')
                .leftJoin('order.channels', 'channel')
                .where('channel.id = :ch', { ch: ctx.channelId })
                .andWhere('order.state != :cancelled', { cancelled: 'Cancelled' })
                .andWhere('order.customFields.hallStatus IS NOT NULL')
                .getMany();
            const now = Date.now();
            for (const o of orders) {
                const cf = o.customFields;
                if (cf.deliveryStatus === 'exception') {
                    const at = cf.exceptionReportedAt ? new Date(cf.exceptionReportedAt).getTime() : NaN;
                    const mins = Number.isNaN(at) ? null : Math.round((now - at) / 60000);
                    const detail = [cf.exceptionType, cf.exceptionNote].filter(Boolean).join('｜') || '异常未处置';
                    exceptions.push(`${o.code} ${t.name} ${detail}${mins != null ? `（已 ${mins} 分钟）` : ''}`);
                    continue;
                }
                const entry = this.overdueOf(o, cf, cfg, now);
                if (entry)
                    overdue.push(`${o.code} ${t.name} ${entry}`);
            }
        }
        return { exceptions, overdue };
    }
    /** 各环节超时判定（与调度兜底阈值保持一致，仅用于群里提示，不做任何改单） */
    overdueOf(order, cf, cfg, now) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const minutesSince = (t) => t ? Math.round((now - new Date(t).getTime()) / 60000) : null;
        const exceeded = (m, threshold) => m != null && m > threshold;
        const accept = (_a = cfg.merchantAcceptMinutes) !== null && _a !== void 0 ? _a : 5;
        const auto = (_b = cfg.merchantAutoOpenMinutes) !== null && _b !== void 0 ? _b : 15;
        const push = (_c = cfg.externalPushTimeoutMinutes) !== null && _c !== void 0 ? _c : 10;
        const fallback = (_d = cfg.externalFallbackMinutes) !== null && _d !== void 0 ? _d : 20;
        switch (cf.hallStatus) {
            case 'pending_merchant': {
                const m = minutesSince((_e = cf.hallEnteredAt) !== null && _e !== void 0 ? _e : order.createdAt);
                return exceeded(m, accept) ? `商户 ${m} 分钟未接单（阈值 ${accept}）` : null;
            }
            case 'accepted': {
                const m = minutesSince((_f = cf.hallEnteredAt) !== null && _f !== void 0 ? _f : order.createdAt);
                return exceeded(m, auto) ? `商户 ${m} 分钟未出餐（阈值 ${auto}）` : null;
            }
            case 'open': {
                const m = minutesSince((_g = cf.hallEnteredAt) !== null && _g !== void 0 ? _g : order.createdAt);
                return exceeded(m, auto) ? `待抢单 ${m} 分钟无人接（阈值 ${auto}）` : null;
            }
            case 'grabbed': {
                const m = minutesSince(cf.assignedAt);
                return exceeded(m, RIDER_PICK_TIMEOUT_MIN) ? `骑手 ${m} 分钟未取货（阈值 ${RIDER_PICK_TIMEOUT_MIN}）` : null;
            }
            case 'pending_dispatch': {
                const m = minutesSince((_k = (_j = (_h = cf.assignedAt) !== null && _h !== void 0 ? _h : cf.thirdPartyDispatchAt) !== null && _j !== void 0 ? _j : cf.hallEnteredAt) !== null && _k !== void 0 ? _k : order.createdAt);
                return exceeded(m, push) ? `待推外部 ${m} 分钟（阈值 ${push}）` : null;
            }
            case 'third_party': {
                const m = minutesSince(cf.thirdPartyDispatchAt);
                return exceeded(m, fallback) ? `外部快递 ${m} 分钟未接单/取货（阈值 ${fallback}）` : null;
            }
            case 'owned_pool': {
                const m = minutesSince((_l = cf.hallEnteredAt) !== null && _l !== void 0 ? _l : order.createdAt);
                return exceeded(m, auto) ? `自营池 ${m} 分钟无人接（阈值 ${auto}）` : null;
            }
            case 'owned_dispatched':
            case 'merchant_delivering': {
                const m = minutesSince(cf.assignedAt);
                return exceeded(m, auto) ? `配送 ${m} 分钟未到交接点（阈值 ${auto}）` : null;
            }
            default:
                return null;
        }
    }
    // ---------- 写操作 ----------
    async accept(chat, chatId, openId, cmd) {
        const found = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!found)
            return;
        await this.merchant.acceptOrder(found.ctx, found.order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已接单：${found.order.code}`);
    }
    async cooking(chat, chatId, openId, cmd) {
        const found = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!found)
            return;
        await this.merchant.cookingDone(found.ctx, found.order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已出餐：${found.order.code}`);
    }
    /** 拒单第一步：只登记待确认，不执行任何退款/取消 */
    async stageReject(chatId, openId, cmd) {
        if (!cmd.orderCode) {
            await this.reply(chatId, '用法：拒单 <单号> <原因>');
            return;
        }
        this.cleanupConfirmations();
        this.pendingReject.set(`${chatId}:${cmd.orderCode}`, { reason: cmd.reason, openId, at: Date.now() });
        await this.reply(chatId, `即将拒单 ${cmd.orderCode}（全额退款并取消订单）。确认请回复「确认拒单 ${cmd.orderCode}」。`);
    }
    async confirmReject(chat, chatId, openId, cmd) {
        var _a;
        if (!cmd.orderCode) {
            await this.reply(chatId, '用法：确认拒单 <单号>');
            return;
        }
        this.cleanupConfirmations();
        const key = `${chatId}:${cmd.orderCode}`;
        const pending = this.pendingReject.get(key);
        if (!pending || pending.openId !== openId) {
            await this.reply(chatId, '确认已过期，请重新发送「拒单 <单号> <原因>」。');
            return;
        }
        this.pendingReject.delete(key);
        const found = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!found)
            return;
        await this.merchant.rejectOrder(found.ctx, found.order.id, pending.reason || '飞书指令拒单');
        await this.audit(chatId, openId, cmd, `ok reason=${(_a = pending.reason) !== null && _a !== void 0 ? _a : ''}`);
        await this.reply(chatId, `已拒单并退款：${found.order.code}`);
    }
    async setPaused(chat, chatId, openId, paused, store) {
        let token = chat.channel;
        if (chat.scope === 'platform') {
            const targets = await this.channelTargets();
            const target = store ? targets.find(t => t.name === store || t.token === store) : undefined;
            if (!target) {
                await this.reply(chatId, `请指定店铺，例如「${paused ? '关店' : '开店'} canteen-a」。当前店铺：${targets.map(t => t.name).join('、') || '无'}`);
                return;
            }
            token = target.token;
        }
        if (!token) {
            await this.reply(chatId, '该群未绑定店铺，无法执行开关店。');
            return;
        }
        const ctx = await this.ctxForToken(token);
        await this.merchant.setPaused(ctx, paused);
        await this.audit(chatId, openId, { name: paused ? 'close' : 'open' }, `ok store=${store !== null && store !== void 0 ? store : token}`);
        await this.reply(chatId, paused ? `已暂停营业：${store !== null && store !== void 0 ? store : token}` : `已恢复营业：${store !== null && store !== void 0 ? store : token}`);
    }
    // ---------- 工具 ----------
    async requireOrder(chat, chatId, code) {
        var _a, _b;
        if (!code) {
            await this.reply(chatId, '请带单号，例如「接单 A1234」。');
            return null;
        }
        const order = await this.connection.rawConnection.getRepository(core_1.Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        if (!order) {
            await this.reply(chatId, `未找到订单：${code}`);
            return null;
        }
        const channel = chat.scope === 'platform'
            ? (_a = order.channels) === null || _a === void 0 ? void 0 : _a[0]
            : (_b = order.channels) === null || _b === void 0 ? void 0 : _b.find(c => c.token === chat.channel);
        if (!channel) {
            await this.reply(chatId, chat.scope === 'platform' ? `订单 ${code} 未绑定店铺` : `未找到本店订单：${code}`);
            return null;
        }
        return { order, ctx: await this.ctxForToken(channel.token) };
    }
    async channelTargets() {
        const cfgs = await this.connection.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).find();
        const ids = [...new Set(cfgs.map(c => Number(c.channelId)).filter(id => id > 0))];
        if (!ids.length)
            return [];
        const channels = await this.connection.rawConnection.getRepository(core_1.Channel).find({
            where: { id: (0, typeorm_1.In)(ids) },
        });
        return channels.map(c => ({ token: c.token, name: c.code }));
    }
    ctxForToken(token) {
        return this.requestContextService.create({ apiType: 'admin', channelOrToken: token });
    }
    async cancelledCount(ctx) {
        return this.connection.getRepository(ctx, core_1.Order).createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.state = :st', { st: 'Cancelled' })
            .andWhere('order.createdAt >= :start', { start: new Date((0, campus_time_1.startOfCampusDay)(Date.now())) })
            .getCount();
    }
    async exceptionCount(ctx) {
        return this.connection.getRepository(ctx, core_1.Order).createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.deliveryStatus = 'exception'")
            .getCount();
    }
    isOperator(chat, openId) {
        return chat.operators.includes(openId) || chat.owners.includes(openId);
    }
    isRateLimited(chatId) {
        var _a;
        const now = Date.now();
        const arr = ((_a = this.rate.get(chatId)) !== null && _a !== void 0 ? _a : []).filter(t => now - t < 60000);
        arr.push(now);
        this.rate.set(chatId, arr);
        return arr.length > RATE_LIMIT_PER_MIN;
    }
    cleanupConfirmations() {
        const now = Date.now();
        for (const [k, v] of this.pendingReject) {
            if (now - v.at > CONFIRM_TTL_MS)
                this.pendingReject.delete(k);
        }
    }
    async reply(chatId, text) {
        await this.client.sendToChat(chatId, text);
    }
    async audit(chatId, openId, cmd, result) {
        var _a;
        core_1.Logger.info(`[FeishuAudit] chat=${chatId} open_id=${openId} cmd=${cmd.name} order=${(_a = cmd.orderCode) !== null && _a !== void 0 ? _a : '-'} result=${result}`, loggerCtx);
    }
};
exports.FeishuCommandService = FeishuCommandService;
exports.FeishuCommandService = FeishuCommandService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_config_1.FeishuConfigService,
        feishu_client_1.FeishuClient,
        core_1.RequestContextService,
        core_1.TransactionalConnection,
        merchant_admin_service_1.MerchantAdminService,
        delivery_stats_service_1.DeliveryStatsService])
], FeishuCommandService);
//# sourceMappingURL=feishu.command.service.js.map