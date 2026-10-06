import { Injectable } from '@nestjs/common';
import { ID, Order, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusConfigService } from './campus-config.service';
import { HallService } from './hall.service';

export interface MerchantBoardLine {
    name: string;
    quantity: number;
    price: number;
}

export interface MerchantBoardOrder {
    id: string;
    code: string;
    createdAt: Date;
    total: number;
    building: string;
    zone: string;
    slotText: string;
    route: string;
    riderName: string | null;
    lines: MerchantBoardLine[];
}

export interface MerchantBoard {
    paused: boolean;
    merchantConfirmEnabled: boolean;
    pending: MerchantBoardOrder[];
    cooking: MerchantBoardOrder[];
    awaitingRider: MerchantBoardOrder[];
    delivering: MerchantBoardOrder[];
    completedToday: number;
    completedTodayAmount: number;
}

/**
 * 商家接单工作台（admin-api，CampusMerchant 权限，渠道隔离 = 商家角色绑定渠道）。
 * 状态机（merchantConfirmEnabled 渠道）：支付 → pending_merchant（待商家接单）
 * → accepted（备餐中，campusMerchantAcceptOrder）→ open（出餐完成入大厅，
 * campusMerchantCookingDone）→ 骑手 grabbed/delivering → delivered。
 */
@Injectable()
export class MerchantAdminService {
    constructor(
        private connection: TransactionalConnection,
        private config: CampusConfigService,
        private hall: HallService,
    ) {}

    async board(ctx: RequestContext): Promise<MerchantBoard> {
        const cfg = await this.config.getConfig(ctx);
        const repo = this.connection.getRepository(ctx, Order);
        const orders = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .getMany();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const deliveredToday = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.deliveryStatus = 'delivered'")
            .andWhere('order.customFields.deliveredAt >= :start', { start: startOfDay })
            .getMany();

        const active = orders.filter(o => {
            const s = (o.customFields as any).hallStatus;
            return ['pending_merchant', 'accepted', 'open', 'grabbed'].includes(s);
        });
        const dtos = await this.toDto(ctx, active);
        const cfOf = (o: Order) => o.customFields as any;
        const pending = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'pending_merchant');
        const cooking = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'accepted');
        const awaitingRider = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'open');
        const delivering = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'grabbed');
        const completedTodayAmount = deliveredToday.reduce((s, o) => s + (o.total || 0), 0);
        return {
            paused: cfg.paused,
            merchantConfirmEnabled: cfg.merchantConfirmEnabled,
            pending,
            cooking,
            awaitingRider,
            delivering,
            completedToday: deliveredToday.length,
            completedTodayAmount,
        };
    }

    /** 商家接单确认：pending_merchant → accepted */
    async acceptOrder(ctx: RequestContext, orderId: ID) {
        const order = await this.assertChannelOrder(ctx, orderId, 'pending_merchant');
        await this.hall.updateOrder(ctx, order.id as any, { customFields: { hallStatus: 'accepted' } } as any);
        return { ok: true };
    }

    /** 出餐完成：accepted → open 入大厅（hallEnteredAt 重置，骑手侧调度计时从此起算） */
    async cookingDone(ctx: RequestContext, orderId: ID) {
        const order = await this.assertChannelOrder(ctx, orderId, 'accepted');
        await this.hall.updateOrder(ctx, order.id as any, {
            customFields: { hallStatus: 'open', hallEnteredAt: new Date() },
        } as any);
        return { ok: true };
    }

    /** 营业开关：商家仅可切换本渠道 paused，其余配置仍归 CampusConfig 管理员 */
    async setPaused(ctx: RequestContext, paused: boolean) {
        await this.config.updateConfig(ctx, { paused });
        return { ok: true };
    }

    private async assertChannelOrder(ctx: RequestContext, orderId: ID, expect: string) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        if ((order.customFields as any).hallStatus !== expect) {
            throw new UserInputError('当前状态不允许该操作');
        }
        return order;
    }

    /** 组装商家视图 DTO：楼栋名批量查、骑手名批量查，不外泄 admin 内部字段 */
    private async toDto(ctx: RequestContext, orders: Order[]): Promise<MerchantBoardOrder[]> {
        const buildingIds = new Set<string>();
        const riderIds = new Set<number>();
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.buildingId) buildingIds.add(String(cf.buildingId));
            if (cf.deliveryStaffId) riderIds.add(Number(cf.deliveryStaffId));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const customers = riderIds.size
            ? await this.connection.rawConnection.getRepository('Customer').findByIds([...riderIds])
            : [];
        const riderNames = new Map(
            (customers as any[]).map(c => [String(c.id), c.customFields?.riderRealName ?? '']),
        );
        return orders.map(o => {
            const cf = o.customFields as any;
            return {
                id: String(o.id),
                code: o.code,
                createdAt: o.createdAt,
                total: o.total,
                building: cf.buildingId ? buildingNames.get(String(cf.buildingId)) ?? '' : '',
                zone: cf.campusZone ?? '',
                slotText: cf.deliverySlotText ?? '',
                route: cf.fulfillmentRoute ?? '',
                riderName: cf.deliveryStaffId ? riderNames.get(String(cf.deliveryStaffId)) ?? null : null,
                lines: (o.lines ?? []).map(l => ({
                    name: l.productVariant?.name ?? '',
                    quantity: l.quantity,
                    price: l.unitPrice,
                })),
            };
        });
    }
}
