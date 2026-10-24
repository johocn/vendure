import { Injectable } from '@nestjs/common';
import {
    Logger,
    Order,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';

import { DeliveryStatsService } from '../delivery-stats.service';
import { MerchantAdminService } from '../merchant-admin.service';
import { FeishuClient } from './feishu.client';
import { FeishuChatConfig, FeishuConfigService } from './feishu.config';
import { formatBoard, formatDigest, HELP_TEXT } from './feishu.templates';

const loggerCtx = 'Feishu';
const RATE_LIMIT_PER_MIN = 20;
const CONFIRM_TTL_MS = 5 * 60_000;

export type FeishuCommandName =
    | 'help' | 'board' | 'accept' | 'cooking' | 'reject' | 'confirmReject'
    | 'close' | 'open' | 'digest' | 'unknown';

export interface ParsedCommand {
    name: FeishuCommandName;
    orderCode?: string;
    reason?: string;
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
    if (/^(关店|暂停营业|暂停)$/.test(head)) return { name: 'close' };
    if (/^(开店|恢复营业|营业)$/.test(head)) return { name: 'open' };
    if (/^接单$/.test(head)) return { name: 'accept', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^出餐$/.test(head)) return { name: 'cooking', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^确认拒单$/.test(head)) return { name: 'confirmReject', orderCode: arg ? arg.split(' ')[0] : undefined };
    if (/^拒单$/.test(head)) {
        const [orderCode, ...reasonParts] = arg.split(' ').filter(Boolean);
        return { name: 'reject', orderCode, reason: reasonParts.join(' ').trim() || undefined };
    }
    return { name: 'unknown' };
}

/** 指令所需权限等级：operator=接单/出餐/看板；owner=拒单/开关店 */
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

/**
 * 飞书群指令：解析 → 权限校验 → 调商家工作台服务 → 回复结果。
 * 鉴权模型：chat_id 绑定渠道（FEISHU_CHAT_MAP），open_id 分 operators / owners 两级白名单；
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
            await this.reply(chatId, '无权限执行该指令（需店主白名单）。');
            return;
        }

        try {
            switch (cmd.name) {
                case 'help':
                    await this.reply(chatId, HELP_TEXT);
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
        } catch (e: any) {
            const msg = e?.message ?? String(e);
            await this.audit(chatId, openId, cmd, `error:${msg}`);
            await this.reply(chatId, `执行失败：${msg}`);
        }
    }

    // ---------- 指令实现 ----------

    private async accept(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
        const order = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!order) return;
        const ctx = await this.ctxFor(chat);
        await this.merchant.acceptOrder(ctx, order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已接单：${order.code}`);
    }

    private async cooking(chat: FeishuChatConfig, chatId: string, openId: string, cmd: ParsedCommand) {
        const order = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!order) return;
        const ctx = await this.ctxFor(chat);
        await this.merchant.cookingDone(ctx, order.id);
        await this.audit(chatId, openId, cmd, 'ok');
        await this.reply(chatId, `已出餐：${order.code}`);
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
        const order = await this.requireOrder(chat, chatId, cmd.orderCode);
        if (!order) return;
        const ctx = await this.ctxFor(chat);
        await this.merchant.rejectOrder(ctx, order.id, pending.reason || '飞书指令拒单');
        await this.audit(chatId, openId, cmd, `ok reason=${pending.reason ?? ''}`);
        await this.reply(chatId, `已拒单并退款：${order.code}`);
    }

    private async setPaused(chat: FeishuChatConfig, chatId: string, openId: string, paused: boolean) {
        const ctx = await this.ctxFor(chat);
        await this.merchant.setPaused(ctx, paused);
        await this.audit(chatId, openId, { name: paused ? 'close' : 'open' }, 'ok');
        await this.reply(chatId, paused ? '已暂停营业。' : '已恢复营业。');
    }

    // ---------- 查询 ----------

    private async boardText(channelToken: string, withDigest: boolean): Promise<string> {
        const ctx = await this.requestContextService.create({ apiType: 'admin', channelOrToken: channelToken });
        const board = await this.merchant.board(ctx);
        if (!withDigest) return formatBoard(board);

        const startOfDay = new Date(startOfDayOf(Date.now()));
        const stats = await this.deliveryStats.stats(ctx, 'today');
        const repo = this.connection.getRepository(ctx, Order);
        const cancelled = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.state = :st', { st: 'Cancelled' })
            .andWhere('order.createdAt >= :start', { start: startOfDay })
            .getCount();
        const exceptionCount = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.deliveryStatus = 'exception'")
            .getCount();
        return formatDigest({
            ...board,
            date: campusDayKeyOf(Date.now()),
            totalOrders: stats.kpis.totalOrders,
            onTimeRate: stats.kpis.onTimeRate,
            cancelled,
            exceptionCount,
        });
    }

    // ---------- 工具 ----------

    private async requireOrder(chat: FeishuChatConfig, chatId: string, code?: string): Promise<Order | null> {
        if (!code) {
            await this.reply(chatId, '请带单号，例如「接单 A1234」。');
            return null;
        }
        const ctx = await this.ctxFor(chat);
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) {
            await this.reply(chatId, `未找到本店订单：${code}`);
            return null;
        }
        return order;
    }

    private ctxFor(chat: FeishuChatConfig): Promise<RequestContext> {
        return this.requestContextService.create({ apiType: 'admin', channelOrToken: chat.channel });
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

function startOfDayOf(t: number): number {
    const shifted = t + 8 * 3600_000;
    const day = 24 * 3600_000;
    return shifted - (((shifted % day) + day) % day) - 8 * 3600_000;
}

function campusDayKeyOf(t: number): string {
    const d = new Date(t + 8 * 3600_000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
