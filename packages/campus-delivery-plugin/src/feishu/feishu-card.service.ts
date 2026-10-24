import { Injectable } from '@nestjs/common';
import { Logger, Order, TransactionalConnection } from '@vendure/core';

import { CampusBuilding } from '../campus-building.entity';
import { FeishuClient } from './feishu.client';
import { buildOrderCard, OrderStatusInput } from './feishu.templates';

const loggerCtx = 'Feishu';

/**
 * 订单卡片：数据只从现有 order / campus_building / customer 读，不建表、不落索引。
 * 短码在展示层计算，完整单号只放在按钮 value 里（点击事件原样带回，引用回复也能回读到）。
 *
 * P2.1 告警合并缓存：
 * - codeToMessage   → orderCode → { chatId: messageId }        （发卡片时写，用于 PATCH 刷新）
 * - codeToAlerts    → orderCode → [{ dedupeKey, alertText }]   （appendAlert 时写，buildCard 重建卡片时读）
 *
 * 关键：appendAlert 先写入 codeToAlerts → 再调 buildCard（模板渲染时带 alerts 数组）→ updateCard PATCH 整卡。
 *       这样运营点按钮 handler 调 cards.refresh → buildCard 时 alerts 还在 Map 里 → 告警行不会被刷新覆盖丢失。
 */
@Injectable()
export class FeishuCardService {
    /** orderCode → { chatId: messageId } */
    private codeToMessage = new Map<string, Record<string, string>>();
    /** orderCode → [{ dedupeKey, alertText }] 进程内告警历史，buildCard 重建卡片时注入 */
    private codeToAlerts = new Map<string, Array<{ key: string; text: string }>>();

    constructor(
        private client: FeishuClient,
        private connection: TransactionalConnection,
    ) {}

    /** 告警合并入口：pushEvent 带 orderCode 时先尝试 PATCH 卡片追加告警，返回是否成功 */
    async appendAlert(orderCode: string, alertText: string, dedupeKey?: string): Promise<boolean> {
        const mapping = this.codeToMessage.get(orderCode);
        if (!mapping) return false;

        // Bug 2 修复：去重用 dedupeKey 精确匹配（dispatch 传的如 rider_pick_alert:CODE），
        // 不是 title 文本。相同 dedupeKey + 相同 text 才跳过；相同 dedupeKey 但 text 不同（如 13→14min）追加新行。
        const existing = this.codeToAlerts.get(orderCode) ?? [];
        const matched = dedupeKey
            ? existing.find(a => a.key === dedupeKey && a.text === alertText)
            : existing.find(a => a.text === alertText);
        if (matched) return true; // 已在 Map 里，buildCard 会带上

        existing.push({ key: dedupeKey ?? alertText, text: alertText });
        // 最多保留 10 条（同单告警不可能超过这个数，超出丢最老的）
        if (existing.length > 10) existing.splice(0, existing.length - 10);
        this.codeToAlerts.set(orderCode, existing);

        // 如果已经超过 20 条告警（异常反复触发），手动触发一轮 GC——进程内不能无限增
        if (this.codeToAlerts.size > 200) this.gcAlerts();

        let anyOk = false;
        for (const [chatId, messageId] of Object.entries(mapping)) {
            try {
                const card = await this.buildCard(orderCode);
                if (!card) continue;
                const ok = await this.client.updateCard(messageId, card);
                if (ok) anyOk = true;
            } catch { /* 单群失败不影响其他群 */ }
        }
        return anyOk;
    }

    /** 显式清掉某单的告警行（异常终态改 exception_final 时由 notify 层调用） */
    clearAlerts(orderCode: string): void {
        this.codeToAlerts.delete(orderCode);
    }

    private gcAlerts(): void {
        const now = Date.now();
        // 只清已经超过 24h 没更新的 order 的 alerts
        // 但我们没存时间戳，简单点：超过 500 就清前半（FIFO 近似）
        if (this.codeToAlerts.size > 500) {
            let n = 0;
            for (const k of this.codeToAlerts.keys()) {
                this.codeToAlerts.delete(k);
                n++;
                if (n >= Math.floor(this.codeToAlerts.size / 2)) break;
            }
        }
        void now; // silence unused
    }

    /** 读现有表组装卡片所需数据（与文本查单共用同一份视图） */
    async loadOrderView(code: string): Promise<OrderStatusInput | null> {
        if (!code) return null;
        const order = await this.connection.rawConnection.getRepository(Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        if (!order) return null;
        const cf = order.customFields as any;

        let building: string | null = null;
        if (cf?.buildingId) {
            const b = await this.connection.rawConnection.getRepository(CampusBuilding).findOne({
                where: { id: String(cf.buildingId) as any },
            });
            building = b?.name ?? null;
        }

        let riderName: string | null = null;
        if (cf?.deliveryStaffId) {
            const rider: any = await this.connection.rawConnection.getRepository('Customer').findOne({
                where: { id: Number(cf.deliveryStaffId) },
            });
            riderName = rider?.customFields?.riderRealName ?? null;
        }

        const reportedAt = cf?.exceptionReportedAt ? new Date(cf.exceptionReportedAt).getTime() : NaN;
        // Bug 1 修复：从 codeToAlerts Map 读告警历史注入 views，这样 buildCard → 按钮 refresh 重建时告警行保留
        const alerts = this.codeToAlerts.get(code)?.map(a => a.text) ?? [];
        return {
            code: order.code,
            store: order.channels?.[0]?.code ?? '',
            orderState: String(order.state),
            hallStatus: cf?.hallStatus ?? null,
            deliveryStatus: cf?.deliveryStatus ?? null,
            route: cf?.fulfillmentRoute ?? null,
            riderName,
            building,
            zone: cf?.campusZone ?? null,
            slotText: cf?.deliverySlotText ?? null,
            total: order.total,
            exceptionType: cf?.exceptionType ?? null,
            exceptionNote: cf?.exceptionNote ?? null,
            exceptionMinutes: Number.isNaN(reportedAt) ? null : Math.round((Date.now() - reportedAt) / 60_000),
            createdAt: new Date(order.createdAt).getTime(),
            at: Date.now(),
            alerts,
        };
    }

    async buildCard(code: string): Promise<Record<string, unknown> | null> {
        const view = await this.loadOrderView(code);
        return view ? buildOrderCard(view) : null;
    }

    /** 发订单卡片，返回 message_id（用于后续原地刷新） */
    async sendOrderCard(chatId: string, code: string): Promise<string | null> {
        const card = await this.buildCard(code);
        if (!card) return null;
        return this.client.sendCard(chatId, card);
    }

    /** 新订单卡片：发到所有已映射群；一个都没发出去时返回 false，让调用方降级文本 */
    async broadcastOrderCard(code: string): Promise<boolean> {
        if (!this.client.enabled) return false;
        const card = await this.buildCard(code);
        if (!card) return false;
        const chats = Object.keys((this.client as any).cfg?.settings?.chats ?? {});
        const msgMap: Record<string, string> = {};
        let ok = false;
        for (const chatId of chats) {
            const mid = await this.client.sendCard(chatId, card);
            if (mid) { msgMap[chatId] = mid; ok = true; }
        }
        if (ok) this.codeToMessage.set(code, msgMap);
        return ok;
    }

    /** 外部写入 message_id（如用户查单触发 sendOrderCard 后） */
    trackMessage(code: string, chatId: string, messageId: string): void {
        const cur = this.codeToMessage.get(code) ?? {};
        cur[chatId] = messageId;
        this.codeToMessage.set(code, cur);
    }

    /** 按钮操作后原地刷新卡片（失败不抛错，由调用方决定是否补文本） */
    async refresh(messageId: string | undefined, code: string): Promise<boolean> {
        if (!messageId) return false;
        const card = await this.buildCard(code); // loadOrderView 里会从 codeToAlerts 注入 alerts → Bug 1 修复
        if (!card) return false;
        try {
            return await this.client.updateCard(messageId, card);
        } catch (e: any) {
            Logger.warn(`飞书卡片刷新失败 message=${messageId}: ${e?.message ?? e}`, loggerCtx);
            return false;
        }
    }
}
