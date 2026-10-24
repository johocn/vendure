import { Injectable } from '@nestjs/common';
import { Logger, Order, TransactionalConnection } from '@vendure/core';

import { CampusBuilding } from '../campus-building.entity';
import { FeishuClient } from './feishu.client';
import { buildOrderCard, OrderStatusInput } from './feishu.templates';

const loggerCtx = 'Feishu';

/**
 * 订单卡片：数据只从现有 order / campus_building / customer 读，不建表、不落索引。
 * 短码在展示层计算，完整单号只放在按钮 value 里（点击事件原样带回，引用回复也能回读到）。
 */
@Injectable()
export class FeishuCardService {
    constructor(
        private client: FeishuClient,
        private connection: TransactionalConnection,
    ) {}

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
        return this.client.broadcastCard(card);
    }

    /** 按钮操作后原地刷新卡片（失败不抛错，由调用方决定是否补文本） */
    async refresh(messageId: string | undefined, code: string): Promise<boolean> {
        if (!messageId) return false;
        const card = await this.buildCard(code);
        if (!card) return false;
        try {
            return await this.client.updateCard(messageId, card);
        } catch (e: any) {
            Logger.warn(`飞书卡片刷新失败 message=${messageId}: ${e?.message ?? e}`, loggerCtx);
            return false;
        }
    }
}
