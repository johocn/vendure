import { Injectable } from '@nestjs/common';
import { OrderService, RequestContext, UserInputError } from '@vendure/core';
import { DataSource } from 'typeorm';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { DeliverySlot } from './delivery-slot.entity';

@Injectable()
export class CampusConfigService {
    constructor(private dataSource: DataSource, private orderService: OrderService) {}

    listZones(ctx: RequestContext) {
        return this.dataSource.getRepository(CampusZone).find({ where: { channelId: ctx.channelId as any } });
    }

    async createZone(ctx: RequestContext, name: string, fee: number) {
        return this.dataSource.getRepository(CampusZone).save({ name, fee, channelId: ctx.channelId } as any);
    }

    listBuildings(zoneId?: number) {
        return this.dataSource
            .getRepository(CampusBuilding)
            .find(zoneId ? { where: { zoneId } } : {});
    }

    async createBuilding(ctx: RequestContext, name: string, zoneId: number, detail?: string) {
        return this.dataSource
            .getRepository(CampusBuilding)
            .save({ name, zoneId, detail, channelId: ctx.channelId } as any);
    }

    async getConfig(ctx: RequestContext): Promise<CampusFulfillmentConfig> {
        const repo = this.dataSource.getRepository(CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: ctx.channelId as any } });
        if (!cfg) {
            // 显式写入默认值（与实体列默认值一致），保证内存对象与 DB 默认一致
            cfg = await repo.save(
                new CampusFulfillmentConfig({
                    channelId: ctx.channelId,
                    routesEnabled: ['R1', 'R3', 'R4', 'R5'],
                    riderCommissionRate: 100,
                    autoAssignMinutes: 10,
                    paused: false,
                } as any),
            );
        }
        return cfg;
    }

    async updateConfig(ctx: RequestContext, patch: Partial<CampusFulfillmentConfig>) {
        const cfg = await this.getConfig(ctx);
        Object.assign(cfg, patch);
        return this.dataSource.getRepository(CampusFulfillmentConfig).save(cfg);
    }

    async createSlot(
        ctx: RequestContext,
        input: { slotDate: string; startTime: string; endTime: string; zoneId?: number; capacity?: number },
    ) {
        return this.dataSource.getRepository(DeliverySlot).save({
            slotDate: input.slotDate,
            startTime: input.startTime,
            endTime: input.endTime,
            zoneId: input.zoneId != null ? Number(input.zoneId) : null,
            capacity: input.capacity ?? 20,
            active: true,
            channelId: ctx.channelId,
        } as any);
    }

    async updateSlot(
        ctx: RequestContext,
        id: number,
        patch: { capacity?: number; active?: boolean; startTime?: string; endTime?: string },
    ) {
        const repo = this.dataSource.getRepository(DeliverySlot);
        const slot = await repo.findOne({ where: { id: id as any } });
        if (!slot) throw new UserInputError('时段不存在');
        Object.assign(slot, patch);
        return repo.save(slot);
    }

    async listSlots(ctx: RequestContext) {
        return this.dataSource.getRepository(DeliverySlot).find({
            where: { channelId: ctx.channelId as any },
            order: { slotDate: 'ASC', startTime: 'ASC' },
        });
    }

    /** C 端可订时段：active 且未过期，带余量 */
    async slotsForShop(ctx: RequestContext) {
        const slots = await this.dataSource.getRepository(DeliverySlot).find({
            where: { channelId: ctx.channelId as any, active: true },
            order: { slotDate: 'ASC', startTime: 'ASC' },
        });
        const today = new Date().toISOString().slice(0, 10);
        return slots
            .filter(s => s.active)
            .filter(s => s.slotDate >= today)
            .map(s => ({ ...s, remaining: Math.max(0, s.capacity - s.lockedCount) }))
            .filter(s => s.remaining > 0);
    }

    /** C 端选楼/选区/选路线/选时段写入 activeOrder。
     * route/slot 可选（向后兼容 plan2 旧调用形态）；route 为 R1/R2/R3；R2 的到校确认走 r2-mark 链路。 */
    async setDeliveryTarget(
        ctx: RequestContext,
        zoneId: number,
        buildingId: number,
        route?: 'R1' | 'R2' | 'R3',
        slotId?: number,
    ) {
        const zone = await this.dataSource.getRepository(CampusZone).findOne({ where: { id: zoneId as any } });
        if (!zone) throw new UserInputError('分区不存在');
        const building = await this.dataSource
            .getRepository(CampusBuilding)
            .findOne({ where: { id: buildingId as any } });
        if (!building) throw new UserInputError('宿舍楼不存在');
        // R2 与 R1/R3 同走 zone/building 写入（R2 原单收宿舍楼信息供接力预填）；R4 不经骑手不落此链路
        if (route && !['R1', 'R2', 'R3'].includes(route)) throw new UserInputError('配送路线不合法');
        const fields: Record<string, string> = {
            buildingId: String(buildingId),
            campusZone: zone.name,
        };
        if (route) fields.fulfillmentRoute = route;
        if (slotId != null) {
            const slot = await this.dataSource.getRepository(DeliverySlot).findOne({ where: { id: slotId as any } });
            if (!slot || !slot.active || Number(slot.channelId) !== Number(ctx.channelId)) {
                throw new UserInputError('时段不可用');
            }
            if (slot.lockedCount >= slot.capacity) throw new UserInputError('该时段已满');
            fields.deliverySlotId = String(slotId);
            fields.deliverySlotText = `${slot.slotDate} ${slot.startTime}-${slot.endTime}`;
        }
        const orderId = ctx.session?.activeOrderId;
        if (!orderId) throw new UserInputError('购物车为空');
        // 与 core shop setOrderCustomFields mutation 内部实现等价（patchEntity + 保存 + OrderEvent）
        return this.orderService.updateCustomFields(ctx, orderId, fields);
    }
}
