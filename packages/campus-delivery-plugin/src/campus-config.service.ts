import { Injectable } from '@nestjs/common';
import { Order, OrderService, RequestContext, UserInputError } from '@vendure/core';
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

    /** 分区改名/改运费（渠道隔离）；分区名被历史订单快照引用，仅改当前配置不影响已下单 */
    async updateZone(
        ctx: RequestContext,
        id: number,
        patch: { name?: string; fee?: number },
    ) {
        const repo = this.dataSource.getRepository(CampusZone);
        const zone = await repo.findOne({ where: { id: id as any, channelId: ctx.channelId as any } });
        if (!zone) throw new UserInputError('分区不存在');
        if (patch.name !== undefined) {
            const name = String(patch.name).trim();
            if (!name) throw new UserInputError('分区名称不能为空');
            zone.name = name;
        }
        if (patch.fee !== undefined) {
            const fee = Number(patch.fee);
            if (!Number.isInteger(fee) || fee < 0) throw new UserInputError('分区运费必须为非负整数（分）');
            zone.fee = fee;
        }
        return repo.save(zone);
    }

    /** 删除楼栋：仅当无订单引用（含历史指向该楼栋的订单）时允许，避免配送目标丢失 */
    async deleteBuilding(ctx: RequestContext, id: number) {
        const repo = this.dataSource.getRepository(CampusBuilding);
        const building = await repo.findOne({ where: { id: id as any, channelId: ctx.channelId as any } });
        if (!building) throw new UserInputError('宿舍楼不存在');
        const used = await this.dataSource
            .getRepository(Order)
            .createQueryBuilder('order')
            .where('order.customFields.buildingId = :bid', { bid: String(id) })
            .getCount();
        if (used > 0) throw new UserInputError(`该宿舍楼已有 ${used} 个订单引用，不能删除`);
        await repo.remove(building);
        return true;
    }

    /** 楼栋按当前渠道隔离：后台维护页与 C 端选楼都只读本渠道数据 */
    listBuildings(ctx: RequestContext, zoneId?: number) {
        const where: any = { channelId: ctx.channelId as any };
        if (zoneId) where.zoneId = zoneId;
        return this.dataSource.getRepository(CampusBuilding).find({ where });
    }

    async createBuilding(ctx: RequestContext, name: string, zoneId: number, detail?: string, lat?: number, lng?: number) {
        return this.dataSource
            .getRepository(CampusBuilding)
            .save({ name, zoneId, detail, lat, lng, channelId: ctx.channelId } as any);
    }

    /** 楼栋信息/坐标维护（骑手跟踪页目标点）；仅更新传入字段 */
    async updateBuilding(
        ctx: RequestContext,
        id: number,
        patch: { name?: string; detail?: string; lat?: number | null; lng?: number | null },
    ) {
        const repo = this.dataSource.getRepository(CampusBuilding);
        // 渠道过滤：不允许跨店铺改别家楼栋
        const building = await repo.findOne({ where: { id: id as any, channelId: ctx.channelId as any } });
        if (!building) throw new UserInputError('宿舍楼不存在');
        if (patch.name !== undefined) building.name = patch.name;
        if (patch.detail !== undefined) building.detail = patch.detail;
        if (patch.lat !== undefined) building.lat = patch.lat as any;
        if (patch.lng !== undefined) building.lng = patch.lng as any;
        return repo.save(building);
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
        // 超时赔付（P2）：开启必须指定券模板；宽限非法值直接拒绝，不再静默回落默认 10 分钟
        if (patch.timeoutGraceMinutes != null) {
            const grace = Number(patch.timeoutGraceMinutes);
            if (!Number.isInteger(grace) || grace < 0 || grace > 240) {
                throw new UserInputError('超时宽限必须为 0-240 的整数（分钟）');
            }
            patch.timeoutGraceMinutes = grace;
        }
        // 赔付回扫窗口（P2）：1-168h，避免窗口过大把陈年旧单批量补赔
        if (patch.timeoutCompensationWindowHours != null) {
            const hours = Number(patch.timeoutCompensationWindowHours);
            if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
                throw new UserInputError('赔付回扫窗口必须为 1-168 的整数（小时）');
            }
            patch.timeoutCompensationWindowHours = hours;
        }
        const nextEnabled =
            patch.timeoutCompensationEnabled !== undefined ? !!patch.timeoutCompensationEnabled : cfg.timeoutCompensationEnabled;
        const nextTemplate =
            patch.timeoutCompensationCouponTemplateId !== undefined
                ? patch.timeoutCompensationCouponTemplateId
                : cfg.timeoutCompensationCouponTemplateId;
        if (nextEnabled && !nextTemplate) {
            throw new UserInputError('开启超时赔付前必须选择赔付券模板');
        }
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
        // 渠道隔离：只能改本渠道时段（DeliverySlot.channelId 物理列，直接按标量查）
        const slot = await repo.findOne({ where: { id: id as any, channelId: ctx.channelId as any } });
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
        const fields: Record<string, any> = {
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
            // 预约锚点 = 时段开始时间（本地时区解析，plan 3.1）；调度 job 于该时点前 30min 放量
            fields.scheduledFor = new Date(`${slot.slotDate}T${slot.startTime}:00`);
        } else {
            // 切回「尽快送」：清空残留时段与预约锚点，避免旧值误触发预约调度
            fields.deliverySlotId = null;
            fields.deliverySlotText = null;
            fields.scheduledFor = null;
        }
        const orderId = ctx.session?.activeOrderId;
        if (!orderId) throw new UserInputError('购物车为空');
        // 与 core shop setOrderCustomFields mutation 内部实现等价（patchEntity + 保存 + OrderEvent）
        return this.orderService.updateCustomFields(ctx, orderId, fields);
    }
}
