import { Injectable } from '@nestjs/common';
import {
    Channel,
    Logger,
    Order,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';

import { CampusBuilding } from '../campus-building.entity';
import { CampusFulfillmentConfig } from '../campus-fulfillment-config.entity';
import { campusDayKey, startOfCampusDay } from '../campus-time';
import { DeliveryStatsService } from '../delivery-stats.service';
import { MerchantAdminService } from '../merchant-admin.service';
import { FeishuCardService } from './feishu-card.service';
import { FeishuClient } from './feishu.client';
import { FeishuChatConfig, FeishuConfigService } from './feishu.config';
import {
    buildSearchCard,
    buildTemplateCard,
    extractOrderCodeFromCard,
    extractOrderCodeFromText,
    formatBoard,
    formatDigest,
    formatExceptions,
    formatOrderStatus,
    formatPlatformBoard,
    formatPlatformDigest,
    HELP_TEXT,
    matchReplyTemplate,
    PlatformStoreLine,
    REPLY_TEMPLATES,
    replyTemplateText,
    SearchRow,
} from './feishu.templates';

const loggerCtx = 'Feishu';
const RATE_LIMIT_PER_MIN = 20;
const CONFIRM_TTL_MS = 5 * 60_000;
const RIDER_PICK_TIMEOUT_MIN = 15;

export type FeishuCommandName =
    | 'help' | 'board' | 'digest' | 'status' | 'exceptions'
    | 'accept' | 'cooking' | 'reject' | 'confirmReject'
    | 'close' | 'open' | 'unknown';

export interface ParsedCommand {
    name: FeishuCommandName;
    orderCode?: string;
    reason?: string;
    /** 关店/开店的目标店铺（平台管理群必填） */
    store?: string;
}

/** 去掉 @ 占位符与首尾空白，再按首个空格切命令与参数（纯函数，便于单测） */
export function parseCommand(raw: string): ParsedCommand {
    const text = (raw ?? '')
        .replace(/@_user_\d+/g, ' ')
        .replace(/@\S+\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return { name: 'unknown' };
    const [head, ...rest] = text.split(' ');
    const arg = rest.join(' ').trim();

    if (/^(帮助|help)$/i.test(head)) return { name: 'help' };
    if (/^(待处理|看板|board)$/i.test(head)) return { name: 'board' };
    if (/^(今日汇总|汇总|digest)$/i.test(head)) return { name: 'digest' };
    if (/^(异常|异常清单|超时|exceptions?)$/i.test(head)) return { name: 'exceptions' };
    if (/^(查|订单|status)$/i.test(head)) return { name: 'status', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^(关店|暂停营业|暂停)$/.test(head)) return { name: 'close', store: arg ? arg.split(' ')[0] : undefined };
    if (/^(开店|恢复营业|营业)$/.test(head)) return { name: 'open', store: arg ? arg.split(' ')[0] : undefined };
    if (/^接单$/.test(head)) return { name: 'accept', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^出餐$/.test(head)) return { name: 'cooking', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^确认拒单$/.test(head)) return { name: 'confirmReject', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^拒单$/.test(head)) {
        const [orderCode, ...reasonParts] = arg.split(' ').filter(Boolean);
        return { name: 'reject', orderCode, reason: reasonParts.join(' ').trim() || undefined };
    }
    return { name: 'unknown' };
}

/** 指令所需权限等级：operator=查询/接单/出餐；owner=拒单/开关店 */
export function requiredRole(cmd: FeishuCommandName): 'none' | 'operator' | 'owner' {
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

interface ChannelTarget {
    /** Channel.token（RequestContextService 只按 token 解析） */
    token: string;
    /** 店铺名（Channel.code，看板/汇总展示用） */
    name: string;
}

/**
 * 飞书群指令：解析 → 权限校验 → 调商家工作台服务 → 回复结果。
 * 群定位：
 * - channel：店铺群，看板/汇总/写操作都限定绑定的店铺；
 * - platform：平台管理群，看板/异常/汇总跨全部店铺，写操作按单号/店铺参数指定。
 * 鉴权：chat_id 白名单（FEISHU_CHAT_MAP）+ open_id 分 operators / owners 两级；
 * 所有操作记审计日志，回复里不出现顾客手机号/详细地址。
 */
@Injectable()
export class FeishuCommandService {
    private rate = new Map<string, number[]>();
    private pendingReject = new Map<string, { reason?: string; openId: string; at: number }>();

    constructor(
        private cfg: FeishuConfigService,
        private client: FeishuClient,
        private cards: FeishuCardService,
        private requestContextService: RequestContextService,
        private connection: TransactionalConnection,
        private merchant: MerchantAdminService,
        private deliveryStats: DeliveryStatsService,
    ) {}

    async handleMessage(input: {
        chatId: string;
        openId: string;
        text: string;
        /** 被引用消息（im.message.receive_v1 的 parent_id） */
        parentId?: string;
        /** 话题根消息（root_id），parent 是普通文本时兜底 */
        rootId?: string;
    }): Promise<void> {
        const { chatId, openId } = input;
        if (!this.client.enabled) return;
        const chat = this.cfg.chatOf(chatId);
        if (!chat) {
            Logger.warn(`未配置的群 chat_id=${chatId}，忽略指令`, loggerCtx);
            return;
        }
        if (this.isRateLimited(chatId)) {
            await this.reply(chatId, '操作过于频繁，请稍后再试。');
            return;
        }

        // 引用绑定：被引用的是订单/候选卡片时，自动把完整单号带进本次沟通
        const quotedCode = await this.quotedCodeOf(input.parentId, input.rootId);
        if (quotedCode) {
            const tpl = matchReplyTemplate(input.text);
            if (tpl) {
                if (!this.isOperator(chat, openId)) {
                    await this.audit(chatId, openId, { name: 'accept', orderCode: quotedCode }, 'denied-template');
                    await this.reply(chatId, '无权限发送模板（需操作员白名单）。');
                    return;
                }
                const ok = await this.replyInThread(chatId, input.parentId ?? input.rootId, replyTemplateText(tpl, quotedCode));
                await this.audit(chatId, openId, { name: 'accept', orderCode: quotedCode }, `template:${tpl.id}:${ok ? 'ok' : 'failed'}`);
                return;
            }
        }

        const cmd = parseCommand(input.text);
        if (!cmd.orderCode && quotedCode && cmd.name !== 'unknown' && cmd.name !== 'help') {
            cmd.orderCode = quotedCode;
        }
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
                    await this.reply(chatId, HELP_TEXT);
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
                    await this.status(chat, chatId, cmd);
                    break;
                case 'accept':
                    await this.accept(chat, chatId, openId, cmd);
                    break;
                case 'cooking':
                    await this.cooking(chat, chatId, openId, cmd);
                    break;
                case 'reject':
                    await this.stageReject(chat, chatId, openId, cmd);
                    break;
                case 'confirmReject':
                    await this.confirmReject(chat, chatId, openId, cmd);
                    break;
                case 'close':
                case 'open':
                    await this.setPaused(chat, chatId, openId, cmd.name === 'close', cmd.store);
                    break;
                default: {
                    const tpl = matchReplyTemplate(input.text);
                    await this.reply(
                        chatId,
                        tpl
                            ? `「${tpl.label}」需先引用订单卡片（或先「查 <尾号>」），再回复或点击模板。`
                            : '未识别指令，发送「帮助」查看可用指令。',
                    );
                }
            }
        } catch (e: any) {
            const msg = e?.message ?? String(e);
            await this.audit(chatId, openId, cmd, `error:${msg}`);
            await this.reply(chatId, `执行失败：${msg}`);
        }
    }

    /** 卡片按钮回调（card.action.trigger）：全部走同一条通道，不落库 */
    async handleCardAction(input: {
        chatId: string;
        openId: string;
        value?: any;
        messageId?: string;
    }): Promise<void> {
        const { chatId, openId, messageId } = input;
        if (!this.client.enabled) return;
        const chat = this.cfg.chatOf(chatId);
        if (!chat) {
            Logger.warn(`未配置的群 chat_id=${chatId}，忽略卡片操作`, loggerCtx);
            return;
        }
        const action = String(input.value?.a ?? '');
        const code = typeof input.value?.c === 'string' ? input.value.c : undefined;
        const known = ['accept', 'cooking', 'status', 'view', 'template', 'tpl', 'exception'];
        if (!known.includes(action)) return;

        const cmd: ParsedCommand = {
            name: action === 'accept' ? 'accept' : action === 'cooking' ? 'cooking' : 'status',
            orderCode: code,
        };
        if (!this.isOperator(chat, openId)) {
            await this.audit(chatId, openId, cmd, 'denied-card');
            await this.reply(chatId, '无权限操作（需操作员白名单）。');
            return;
        }
        if (!code) {
            await this.reply(chatId, '卡片缺少订单信息，请重新发送「查 <尾号>」。');
            return;
        }

        try {
            switch (action) {
                case 'accept': {
                    const found = await this.requireOrder(chat, chatId, code);
                    if (!found) return;
                    await this.merchant.acceptOrder(found.ctx, found.order.id);
                    await this.audit(chatId, openId, cmd, 'ok-card');
                    if (!(await this.cards.refresh(messageId, code))) {
                        await this.reply(chatId, `已接单：${found.order.code}`);
                    }
                    break;
                }
                case 'cooking': {
                    const found = await this.requireOrder(chat, chatId, code);
                    if (!found) return;
                    await this.merchant.cookingDone(found.ctx, found.order.id);
                    await this.audit(chatId, openId, cmd, 'ok-card');
                    if (!(await this.cards.refresh(messageId, code))) {
                        await this.reply(chatId, `已出餐：${found.order.code}`);
                    }
                    break;
                }
                case 'status':
                case 'view':
                    await this.replyInThread(chatId, messageId, await this.statusText(code));
                    break;
                case 'template': {
                    const card = buildTemplateCard(code);
                    const inThread = messageId ? await this.client.replyCard(messageId, card, true) : false;
                    if (!inThread) await this.client.sendCard(chatId, card);
                    break;
                }
                case 'tpl': {
                    const tpl = REPLY_TEMPLATES.find(t => t.id === String(input.value?.t ?? ''));
                    if (!tpl) return;
                    await this.replyInThread(chatId, messageId, replyTemplateText(tpl, code));
                    break;
                }
                case 'exception':
                    await this.replyInThread(
                        chatId,
                        messageId,
                        `【异常上报】订单 ${code} 需跟进：可直接回复「催单 / 联系骑手 / 已联系顾客 / 转客服」选择处理方式；未处置订单会持续出现在「异常」清单。`,
                    );
                    break;
            }
        } catch (e: any) {
            const msg = e?.message ?? String(e);
            await this.audit(chatId, openId, cmd, `error:${msg}`);
            await this.reply(chatId, `执行失败：${msg}`);
        }
    }

    // ---------- 视图 ----------

    async renderBoard(chat: FeishuChatConfig): Promise<string> {
        if (chat.scope === 'platform') return this.platformBoardText();
        return this.channelBoardText(chat.channel!, false);
    }

    async renderDigest(chat: FeishuChatConfig): Promise<string> {
        if (chat.scope === 'platform') return this.platformDigestText();
        return this.channelBoardText(chat.channel!, true);
    }

    async renderExceptions(chat: FeishuChatConfig): Promise<string> {
        const targets = chat.scope === 'platform'
            ? await this.channelTargets()
            : [{ token: chat.channel!, name: chat.channel! }];
        const { exceptions, overdue } = await this.collectIssues(targets);
        return formatExceptions(exceptions, overdue);
    }

    private async platformBoardText(): Promise<string> {
        const targets = await this.channelTargets();
        if (!targets.length) return '暂无已开通外卖的店铺。';
        const { exceptions, overdue } = await this.collectIssues(targets);
        const stores: PlatformStoreLine[] = [];
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
        return formatPlatformBoard({ stores, exceptions, overdue, at: Date.now() });
    }

    private async platformDigestText(): Promise<string> {
        const targets = await this.channelTargets();
        if (!targets.length) return '暂无已开通外卖的店铺。';
        const rows: Array<{ name: string; completed: number; amount: number; onTimeRate: number; cancelled: number; exception: number }> = [];
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
        return formatPlatformDigest({
            date: campusDayKey(Date.now()),
            stores: rows,
            totalOrders,
            cancelled,
            completed,
            amount,
            onTimeRate: weight ? Math.round(weighted / weight) : 0,
            exception,
        });
    }

    private async channelBoardText(channelToken: string, withDigest: boolean): Promise<string> {
        const ctx = await this.ctxForToken(channelToken);
        const board = await this.merchant.board(ctx);
        if (!withDigest) return formatBoard(board);

        const stats = await this.deliveryStats.stats(ctx, 'today');
        return formatDigest({
            ...board,
            date: campusDayKey(Date.now()),
            totalOrders: stats.kpis.totalOrders,
            onTimeRate: stats.kpis.onTimeRate,
            cancelled: await this.cancelledCount(ctx),
            exceptionCount: await this.exceptionCount(ctx),
        });
    }

    // ---------- 查单：精确 + 模糊（只读现有 order 表） ----------

    private async status(chat: FeishuChatConfig, chatId: string, cmd: ParsedCommand): Promise<void> {
        if (!cmd.orderCode) {
            await this.reply(chatId, '用法：查 <尾号/楼栋/单号>，例如「查 1234」「查 3 栋」。');
            return;
        }
        const exact = await this.findExactOrder(chat, cmd.orderCode);
        if (exact) {
            if (!(await this.cards.sendOrderCard(chatId, exact.code))) {
                await this.reply(chatId, await this.statusText(exact.code));
            }
            return;
        }
        const rows = await this.searchOrders(chat, cmd.orderCode);
        if (!rows.length) {
            await this.reply(chatId, `未找到与「${cmd.orderCode}」匹配的今日订单。`);
            return;
        }
        if (rows.length === 1) {
            if (!(await this.cards.sendOrderCard(chatId, rows[0].code))) {
                await this.reply(chatId, await this.statusText(rows[0].code));
            }
            return;
        }
        await this.client.sendCard(chatId, buildSearchCard(cmd.orderCode, rows));
    }

    async statusText(code: string): Promise<string> {
        const view = await this.cards.loadOrderView(code);
        return view ? formatOrderStatus(view) : `未找到订单：${code}`;
    }

    private async findExactOrder(chat: FeishuChatConfig, code: string): Promise<Order | null> {
        const order = await this.connection.rawConnection.getRepository(Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        if (!order) return null;
        if (chat.scope === 'platform') return order;
        return order.channels?.some(c => c.token === chat.channel) ? order : null;
    }

    /** 模糊检索：今日订单按完整/尾号/楼栋匹配（最多 5 条），纯读、不建索引 */
    private async searchOrders(chat: FeishuChatConfig, query: string): Promise<SearchRow[]> {
        const needle = (query ?? '').trim();
        if (!needle) return [];
        const qb = this.connection.rawConnection.getRepository(Order).createQueryBuilder('order')
            .leftJoinAndSelect('order.channels', 'channel')
            .where('order.createdAt >= :start', { start: new Date(startOfCampusDay(Date.now())) })
            .orderBy('order.createdAt', 'DESC')
            .take(200);
        if (chat.scope !== 'platform' && chat.channel) {
            qb.andWhere('channel.token = :token', { token: chat.channel });
        }
        const orders = await qb.getMany();
        const buildingIds = [...new Set(
            orders.map(o => (o.customFields as any)?.buildingId).filter(Boolean).map(String),
        )];
        const buildings = buildingIds.length
            ? await this.connection.rawConnection.getRepository(CampusBuilding).find({
                where: { id: In(buildingIds) as any },
            })
            : [];
        const nameById = new Map(buildings.map(b => [String(b.id), b.name]));
        const upper = needle.toUpperCase();
        const rows: SearchRow[] = [];
        for (const o of orders) {
            const cf = o.customFields as any;
            const building = nameById.get(String(cf?.buildingId ?? '')) ?? null;
            const hit = o.code.toUpperCase().includes(upper) || (building ? building.includes(needle) : false);
            if (!hit) continue;
            rows.push({
                code: o.code,
                store: o.channels?.[0]?.code ?? chat.channel ?? '',
                hallStatus: cf?.hallStatus ?? null,
                building,
                createdAt: new Date(o.createdAt).getTime(),
            });
            if (rows.length >= 5) break;
        }
        return rows;
    }

    /** 允许用尾号/楼栋操作：唯一命中才放行，多命中发候选卡片 */
    private async resolveOrderCode(chat: FeishuChatConfig, chatId: string, input?: string): Promise<string | null> {
        if (!input) return null;
        const exact = await this.findExactOrder(chat, input);
        if (exact) return exact.code;
        const rows = await this.searchOrders(chat, input);
        if (rows.length === 1) return rows[0].code;
        if (!rows.length) {
            await this.reply(chatId, `未找到与「${input}」匹配的订单。`);
            return null;
        }
        await this.client.sendCard(chatId, buildSearchCard(input, rows));
        return null;
    }

    /** 引用消息 → 完整单号（卡片读按钮 value，文本读最长字母数字串） */
    private async quotedCodeOf(parentId?: string, rootId?: string): Promise<string | undefined> {
        if (!parentId && !rootId) return undefined;
        const direct = parentId ? await this.codeFromMessage(parentId) : undefined;
        if (direct) return direct;
        if (rootId && rootId !== parentId) return this.codeFromMessage(rootId);
        return undefined;
    }

    private async codeFromMessage(messageId: string): Promise<string | undefined> {
        const msg = await this.client.getMessage(messageId);
        if (!msg) return undefined;
        const content = msg.body?.content;
        const fromCard = extractOrderCodeFromCard(content);
        if (fromCard) return fromCard;
        let text: string | undefined;
        try {
            const parsed = JSON.parse(content ?? '');
            text = typeof parsed?.text === 'string' ? parsed.text : undefined;
        } catch {
            text = undefined;
        }
        const candidate = extractOrderCodeFromText(text);
        if (!candidate) return undefined;
        // 文本兜底必须命中真实订单，避免把普通长串误当成单号
        const exists = await this.connection.rawConnection.getRepository(Order).findOne({ where: { code: candidate } });
        return exists?.code;
    }

    // ---------- 异常/超时清单 ----------

    private async collectIssues(targets: ChannelTarget[]): Promise<{ exceptions: string[]; overdue: string[] }> {
        const exceptions: string[] = [];
        const overdue: string[] = [];
        for (const t of targets) {
            const ctx = await this.ctxForToken(t.token);
            const cfg = await this.connection.getRepository(ctx, CampusFulfillmentConfig).findOne({
                where: { channelId: ctx.channelId as any },
            });
            if (!cfg) continue;
            const orders = await this.connection.getRepository(ctx, Order).createQueryBuilder('order')
                .leftJoin('order.channels', 'channel')
                .where('channel.id = :ch', { ch: ctx.channelId as any })
                .andWhere('order.state != :cancelled', { cancelled: 'Cancelled' })
                .andWhere('order.customFields.hallStatus IS NOT NULL')
                .getMany();
            const now = Date.now();
            for (const o of orders) {
                const cf = o.customFields as any;
                if (cf.deliveryStatus === 'exception') {
                    const at = cf.exceptionReportedAt ? new Date(cf.exceptionReportedAt).getTime() : NaN;
                    const mins = Number.isNaN(at) ? null : Math.round((now - at) / 60_000);
                    const detail = [cf.exceptionType, cf.exceptionNote].filter(Boolean).join('｜') || '异常未处置';
                    exceptions.push(`${o.code} ${t.name} ${detail}${mins != null ? `（已 ${mins} 分钟）` : ''}`);
                    continue;
                }
                const entry = this.overdueOf(o, cf, cfg, now);
                if (entry) overdue.push(`${o.code} ${t.name} ${entry}`);
            }
        }
        return { exceptions, overdue };
    }

    /** 各环节超时判定（与调度兜底阈值保持一致，仅用于群里提示，不做任何改单） */
    private overdueOf(
        order: Order,
        cf: any,
        cfg: CampusFulfillmentConfig,
        now: number,
    ): string | null {
        const minutesSince = (t?: Date | string | null) =>
            t ? Math.round((now - new Date(t).getTime()) / 60_000) : null;
        const exceeded = (m: number | null, threshold: number) => m != null && m > threshold;
        const accept = cfg.merchantAcceptMinutes ?? 5;
        const auto = cfg.merchantAutoOpenMinutes ?? 15;
        const push = cfg.externalPushTimeoutMinutes ?? 10;
        const fallback = cfg.externalFallbackMinutes ?? 20;
        switch (cf.hallStatus) {
            case 'pending_merchant': {
                const m = minutesSince(cf.hallEnteredAt ?? order.createdAt);
                return exceeded(m, accept) ? `商户 ${m} 分钟未接单（阈值 ${accept}）` : null;
            }
            case 'accepted': {
                const m = minutesSince(cf.hallEnteredAt ?? order.createdAt);
                return exceeded(m, auto) ? `商户 ${m} 分钟未出餐（阈值 ${auto}）` : null;
            }
            case 'open': {
                const m = minutesSince(cf.hallEnteredAt ?? order.createdAt);
                return exceeded(m, auto) ? `待抢单 ${m} 分钟无人接（阈值 ${auto}）` : null;
            }
            case 'grabbed': {
                const m = minutesSince(cf.assignedAt);
                return exceeded(m, RIDER_PICK_TIMEOUT_MIN) ? `骑手 ${m} 分钟未取货（阈值 ${RIDER_PICK_TIMEOUT_MIN}）` : null;
            }
            case 'pending_dispatch': {
                const m = minutesSince(cf.assignedAt ?? cf.thirdPartyDispatchAt ?? cf.hallEnteredAt ?? order.createdAt);
                return exceeded(m, push) ? `待推外部 ${m} 分钟（阈值 ${push}）` : null;
            }
            case 'third_party': {
                const m = minutesSince(cf.thirdPartyDispatchAt);
                return exceeded(m, fallback) ? `外部快递 ${m} 分钟未接单/取货（阈值 ${fallback}）` : null;
            }
            case 'owned_pool': {
                const m = minutesSince(cf.hallEnteredAt ?? order.createdAt);
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

    private async accept(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
        if (!cmd.orderCode) {
            await this.reply(chatId, '请带单号，例如「接单 A1234」或直接点卡片按钮。');
            return;
        }
        const code = await this.resolveOrderCode(chat, chatId, cmd.orderCode);
        if (!code) return;
        const found = await this.requireOrder(chat, chatId, code);
        if (!found) return;
        await this.merchant.acceptOrder(found.ctx, found.order.id);
        await this.audit(chatId, openId, { ...cmd, orderCode: code }, 'ok');
        await this.reply(chatId, `已接单：${found.order.code}`);
    }

    private async cooking(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
        if (!cmd.orderCode) {
            await this.reply(chatId, '请带单号，例如「出餐 A1234」或直接点卡片按钮。');
            return;
        }
        const code = await this.resolveOrderCode(chat, chatId, cmd.orderCode);
        if (!code) return;
        const found = await this.requireOrder(chat, chatId, code);
        if (!found) return;
        await this.merchant.cookingDone(found.ctx, found.order.id);
        await this.audit(chatId, openId, { ...cmd, orderCode: code }, 'ok');
        await this.reply(chatId, `已出餐：${found.order.code}`);
    }

    /** 拒单第一步：只登记待确认，不执行任何退款/取消 */
    private async stageReject(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
        if (!cmd.orderCode) {
            await this.reply(chatId, '用法：拒单 <单号> <原因>');
            return;
        }
        const code = await this.resolveOrderCode(chat, chatId, cmd.orderCode);
        if (!code) return;
        this.cleanupConfirmations();
        this.pendingReject.set(`${chatId}:${code}`, { reason: cmd.reason, openId, at: Date.now() });
        await this.reply(
            chatId,
            `即将拒单 ${code}（全额退款并取消订单）。确认请回复「确认拒单 ${code}」。`,
        );
    }

    private async confirmReject(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
        if (!cmd.orderCode) {
            await this.reply(chatId, '用法：确认拒单 <单号>');
            return;
        }
        const code = await this.resolveOrderCode(chat, chatId, cmd.orderCode);
        if (!code) return;
        this.cleanupConfirmations();
        const key = `${chatId}:${code}`;
        const pending = this.pendingReject.get(key);
        if (!pending || pending.openId !== openId) {
            await this.reply(chatId, '确认已过期，请重新发送「拒单 <单号> <原因>」。');
            return;
        }
        this.pendingReject.delete(key);
        const found = await this.requireOrder(chat, chatId, code);
        if (!found) return;
        await this.merchant.rejectOrder(found.ctx, found.order.id, pending.reason || '飞书指令拒单');
        await this.audit(chatId, openId, { ...cmd, orderCode: code }, `ok reason=${pending.reason ?? ''}`);
        await this.reply(chatId, `已拒单并退款：${found.order.code}`);
    }

    private async setPaused(chat: FeishuChatConfig, chatId: string, openId: string, paused: boolean, store?: string) {
        let token = chat.channel;
        if (chat.scope === 'platform') {
            const targets = await this.channelTargets();
            const target = store ? targets.find(t => t.name === store || t.token === store) : undefined;
            if (!target) {
                await this.reply(
                    chatId,
                    `请指定店铺，例如「${paused ? '关店' : '开店'} canteen-a」。当前店铺：${targets.map(t => t.name).join('、') || '无'}`,
                );
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
        await this.audit(chatId, openId, { name: paused ? 'close' : 'open' }, `ok store=${store ?? token}`);
        await this.reply(chatId, paused ? `已暂停营业：${store ?? token}` : `已恢复营业：${store ?? token}`);
    }

    // ---------- 工具 ----------

    private async requireOrder(
        chat: FeishuChatConfig,
        chatId: string,
        code?: string,
    ): Promise<{ order: Order; ctx: RequestContext } | null> {
        if (!code) {
            await this.reply(chatId, '请带单号，例如「接单 A1234」。');
            return null;
        }
        const order = await this.connection.rawConnection.getRepository(Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        if (!order) {
            await this.reply(chatId, `未找到订单：${code}`);
            return null;
        }
        const channel = chat.scope === 'platform'
            ? order.channels?.[0]
            : order.channels?.find(c => c.token === chat.channel);
        if (!channel) {
            await this.reply(chatId, chat.scope === 'platform' ? `订单 ${code} 未绑定店铺` : `未找到本店订单：${code}`);
            return null;
        }
        return { order, ctx: await this.ctxForToken(channel.token) };
    }

    private async channelTargets(): Promise<ChannelTarget[]> {
        const cfgs = await this.connection.rawConnection.getRepository(CampusFulfillmentConfig).find();
        const ids = [...new Set(cfgs.map(c => Number(c.channelId)).filter(id => id > 0))];
        if (!ids.length) return [];
        const channels = await this.connection.rawConnection.getRepository(Channel).find({
            where: { id: In(ids) } as any,
        });
        return channels.map(c => ({ token: c.token, name: c.code }));
    }

    private ctxForToken(token: string): Promise<RequestContext> {
        return this.requestContextService.create({ apiType: 'admin', channelOrToken: token });
    }

    private async cancelledCount(ctx: RequestContext): Promise<number> {
        return this.connection.getRepository(ctx, Order).createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.state = :st', { st: 'Cancelled' })
            .andWhere('order.createdAt >= :start', { start: new Date(startOfCampusDay(Date.now())) })
            .getCount();
    }

    private async exceptionCount(ctx: RequestContext): Promise<number> {
        return this.connection.getRepository(ctx, Order).createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.deliveryStatus = 'exception'")
            .getCount();
    }

    private isOperator(chat: FeishuChatConfig, openId: string): boolean {
        return chat.operators.includes(openId) || chat.owners.includes(openId);
    }

    private isRateLimited(chatId: string): boolean {
        const now = Date.now();
        const arr = (this.rate.get(chatId) ?? []).filter(t => now - t < 60_000);
        arr.push(now);
        this.rate.set(chatId, arr);
        return arr.length > RATE_LIMIT_PER_MIN;
    }

    private cleanupConfirmations(): void {
        const now = Date.now();
        for (const [k, v] of this.pendingReject) {
            if (now - v.at > CONFIRM_TTL_MS) this.pendingReject.delete(k);
        }
    }

    private async reply(chatId: string, text: string): Promise<void> {
        await this.client.sendToChat(chatId, text);
    }

    /** 优先回在订单话题里（引用卡片/线程），拿不到锚点消息时退回群消息 */
    private async replyInThread(chatId: string, anchorId: string | undefined, text: string): Promise<boolean> {
        if (anchorId) {
            try {
                if (await this.client.replyToMessage(anchorId, text, true)) return true;
            } catch (e: any) {
                Logger.warn(`飞书线程回复失败 anchor=${anchorId}: ${e?.message ?? e}`, loggerCtx);
            }
        }
        return this.client.sendToChat(chatId, text);
    }

    private async audit(chatId: string, openId: string, cmd: ParsedCommand, result: string): Promise<void> {
        Logger.info(
            `[FeishuAudit] chat=${chatId} open_id=${openId} cmd=${cmd.name} order=${cmd.orderCode ?? '-'} result=${result}`,
            loggerCtx,
        );
    }
}
