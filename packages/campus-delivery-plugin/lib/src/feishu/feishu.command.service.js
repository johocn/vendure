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
const delivery_stats_service_1 = require("../delivery-stats.service");
const merchant_admin_service_1 = require("../merchant-admin.service");
const feishu_client_1 = require("./feishu.client");
const feishu_config_1 = require("./feishu.config");
const feishu_templates_1 = require("./feishu.templates");
const loggerCtx = 'Feishu';
const RATE_LIMIT_PER_MIN = 20;
const CONFIRM_TTL_MS = 5 * 60000;
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
    if (/^(关店|暂停营业|暂停)$/.test(head))
        return { name: 'close' };
    if (/^(开店|恢复营业|营业)$/.test(head))
        return { name: 'open' };
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
/** 指令所需权限等级：operator=接单/出餐/看板；owner=拒单/开关店 */
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
 * 鉴权模型：chat_id 绑定渠道（FEISHU_CHAT_MAP），open_id 分 operators / owners 两级白名单；
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
            await this.reply(chatId, '无权限执行该指令（需店主白名单）。');
            return;
        }
        try {
            switch (cmd.name) {
                case 'help':
                    await this.reply(chatId, feishu_templates_1.HELP_TEXT);
                    break;
                case 'board':
                case 'digest':
                    await this.reply(chatId, await this.boardText(chat.channel, cmd.name === 'digest'));
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
                    await this.setPaused(chat, chatId, openId, cmd.name === 'close');
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
    // ---------- 指令实现 ----------
    async accept(chat, chatId, openId, cmd) {
        const order = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!order)
            return;
        const ctx = await this.ctxFor(chat);
        await this.merchant.acceptOrder(ctx, order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已接单：${order.code}`);
    }
    async cooking(chat, chatId, openId, cmd) {
        const order = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!order)
            return;
        const ctx = await this.ctxFor(chat);
        await this.merchant.cookingDone(ctx, order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已出餐：${order.code}`);
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
        const order = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!order)
            return;
        const ctx = await this.ctxFor(chat);
        await this.merchant.rejectOrder(ctx, order.id, pending.reason || '飞书指令拒单');
        await this.audit(chatId, openId, cmd, `ok reason=${(_a = pending.reason) !== null && _a !== void 0 ? _a : ''}`);
        await this.reply(chatId, `已拒单并退款：${order.code}`);
    }
    async setPaused(chat, chatId, openId, paused) {
        const ctx = await this.ctxFor(chat);
        await this.merchant.setPaused(ctx, paused);
        await this.audit(chatId, openId, { name: paused ? 'close' : 'open' }, 'ok');
        await this.reply(chatId, paused ? '已暂停营业。' : '已恢复营业。');
    }
    // ---------- 查询 ----------
    async boardText(channelToken, withDigest) {
        const ctx = await this.requestContextService.create({ apiType: 'admin', channelOrToken: channelToken });
        const board = await this.merchant.board(ctx);
        if (!withDigest)
            return (0, feishu_templates_1.formatBoard)(board);
        const startOfDay = new Date(startOfDayOf(Date.now()));
        const stats = await this.deliveryStats.stats(ctx, 'today');
        const repo = this.connection.getRepository(ctx, core_1.Order);
        const cancelled = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.state = :st', { st: 'Cancelled' })
            .andWhere('order.createdAt >= :start', { start: startOfDay })
            .getCount();
        const exceptionCount = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere("order.customFields.deliveryStatus = 'exception'")
            .getCount();
        return (0, feishu_templates_1.formatDigest)(Object.assign(Object.assign({}, board), { date: campusDayKeyOf(Date.now()), totalOrders: stats.kpis.totalOrders, onTimeRate: stats.kpis.onTimeRate, cancelled,
            exceptionCount }));
    }
    // ---------- 工具 ----------
    async requireOrder(chat, chatId, code) {
        var _a;
        if (!code) {
            await this.reply(chatId, '请带单号，例如「接单 A1234」。');
            return null;
        }
        const ctx = await this.ctxFor(chat);
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        const inChannel = (_a = order === null || order === void 0 ? void 0 : order.channels) === null || _a === void 0 ? void 0 : _a.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) {
            await this.reply(chatId, `未找到本店订单：${code}`);
            return null;
        }
        return order;
    }
    ctxFor(chat) {
        return this.requestContextService.create({ apiType: 'admin', channelOrToken: chat.channel });
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
function startOfDayOf(t) {
    const shifted = t + 8 * 3600000;
    const day = 24 * 3600000;
    return shifted - (((shifted % day) + day) % day) - 8 * 3600000;
}
function campusDayKeyOf(t) {
    const d = new Date(t + 8 * 3600000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
//# sourceMappingURL=feishu.command.service.js.map