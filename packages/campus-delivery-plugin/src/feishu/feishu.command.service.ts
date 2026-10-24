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
import { FeishuClient } from './feishu.client';
import { FeishuChatConfig, FeishuConfigService } from './feishu.config';
import {
    formatBoard,
    formatDigest,
    formatExceptions,
    formatOrderStatus,
    formatPlatformBoard,
    formatPlatformDigest,
    HELP_TEXT,
    PlatformStoreLine,
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
        private requestContextService: RequestContextService,
        private connection: TransactionalConnection,
        private merchant: MerchantAdminService,
        private deliveryStats: DeliveryStatsService,
    ) {}

    async handleMessage(input: { chatId: string; openId: string; text: string }): Promise<void> {
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

    private async orderStatusText(code?: string): Promise<string> {
        if (!code) return '用法：查 <单号>，例如「查 A1234」。';
        const order = await this.connection.rawConnection.getRepository(Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        if (!order) return `未找到订单：${code}`;
        const cf = order.customFields as any;
        let building: string | null = null;
        if (cf.buildingId) {
            const b = await this.connection.rawConnection.getRepository(CampusBuilding).findOne({
                where: { id: String(cf.buildingId) as any },
            });
            building = b?.name ?? null;
        }
        let riderName: string | null = null;
        if (cf.deliveryStaffId) {
            const customer: any = await this.connection.rawConnection.getRepository('Customer').findOne({
                where: { id: Number(cf.deliveryStaffId) },
            });
            riderName = customer?.customFields?.riderRealName ?? null;
        }
        const reportedAt = cf.exceptionReportedAt ? new Date(cf.exceptionReportedAt).getTime() : NaN;
        return formatOrderStatus({
            code: order.code,
            store: order.channels?.[0]?.code ?? '',
            orderState: String(order.state),
            hallStatus: cf.hallStatus ?? null,
            deliveryStatus: cf.deliveryStatus ?? null,
            route: cf.fulfillmentRoute ?? null,
            riderName,
            building,
            zone: cf.campusZone ?? null,
            slotText: cf.deliverySlotText ?? null,
            total: order.total,
            exceptionType: cf.exceptionType ?? null,
            exceptionNote: cf.exceptionNote ?? null,
            exceptionMinutes: Number.isNaN(reportedAt) ? null : Math.round((Date.now() - reportedAt) / 60_000),
            createdAt: new Date(order.createdAt).getTime(),
            at: Date.now(),
        });
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
        const found = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!found) return;
        await this.merchant.acceptOrder(found.ctx, found.order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已接单：${found.order.code}`);
    }

    private async cooking(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
        const found = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!found) return;
        await this.merchant.cookingDone(found.ctx, found.order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已出餐：${found.order.code}`);
    }

    /** 拒单第一步：只登记待确认，不执行任何退款/取消 */
    private async stageReject(chatId: string, openId: string, cmd: ParsedCommand) {
        if (!cmd.orderCode) {
            await this.reply(chatId, '用法：拒单 <单号> <原因>');
            return;
        }
        this.cleanupConfirmations();
        this.pendingReject.set(`${chatId}:${cmd.orderCode}`, { reason: cmd.reason, openId, at: Date.now() });
        await this.reply(
            chatId,
            `即将拒单 ${cmd.orderCode}（全额退款并取消订单）。确认请回复「确认拒单 ${cmd.orderCode}」。`,
        );
    }

    private async confirmReject(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
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
        if (!found) return;
        await this.merchant.rejectOrder(found.ctx, found.order.id, pending.reason || '飞书指令拒单');
        await this.audit(chatId, openId, cmd, `ok reason=${pending.reason ?? ''}`);
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

    private async audit(chatId: string, openId: string, cmd: ParsedCommand, result: string): Promise<void> {
        Logger.info(
            `[FeishuAudit] chat=${chatId} open_id=${openId} cmd=${cmd.name} order=${cmd.orderCode ?? '-'} result=${result}`,
            loggerCtx,
        );
    }
}
