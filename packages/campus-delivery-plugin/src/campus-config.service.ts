import { Injectable } from '@nestjs/common';
import { Order, OrderService, RequestContext, UserInputError } from '@vendure/core';
import { DataSource } from 'typeorm';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { DeliverySlot } from './delivery-slot.entity';

/** 本地日期 YYYY-MM-DD（slotDate 为本地日期字符串，勿用 UTC 的 toISOString） */
function localDateStr(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** 本地 HH:mm，用于判断当天时段是否已结束 */
function localHhmm(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const SLOT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 时段入参校验（create/update 共用）：日期/时刻格式 + 起止先后 */
function normalizeSlotDate(v: unknown): string {
    const s = String(v ?? '').trim();
    if (!SLOT_DATE_RE.test(s)) throw new UserInputError('日期格式必须为 YYYY-MM-DD');
    return s;
}

function normalizeSlotTime(v: unknown, label: string): string {
    const s = String(v ?? '').trim();
    if (!SLOT_TIME_RE.test(s)) throw new UserInputError(`${label}格式必须为 HH:mm`);
    return s;
}

function normalizeCapacity(v: unknown): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 9999) throw new UserInputError('时段容量必须为 1-9999 的整数');
    return n;
}

/** 经纬度范围校验（未传返回 null） */
function normalizeCoord(v: unknown, kind: 'lat' | 'lng'): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || (kind === 'lat' ? Math.abs(n) > 90 : Math.abs(n) > 180)) {
        throw new UserInputError(kind === 'lat' ? '纬度必须在 -90~90 之间' : '经度必须在 -180~180 之间');
    }
    return n;
}

@Injectable()
export class CampusConfigService {
    constructor(private dataSource: DataSource, private orderService: OrderService) {}

    listZones(ctx: RequestContext) {
        return this.dataSource.getRepository(CampusZone).find({ where: { channelId: ctx.channelId as any } });
    }

    async createZone(ctx: RequestContext, name: string, fee: number) {
        const zoneName = String(name ?? '').trim();
        if (!zoneName) throw new UserInputError('分区名称不能为空');
        const zoneFee = Number(fee);
        if (!Number.isInteger(zoneFee) || zoneFee < 0) throw new UserInputError('分区运费必须为非负整数（分）');
        return this.dataSource.getRepository(CampusZone).save({ name: zoneName, fee: zoneFee, channelId: ctx.channelId } as any);
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
        const buildingName = String(name ?? '').trim();
        if (!buildingName) throw new UserInputError('楼栋名称不能为空');
        // 分区必须属于当前店铺，防止把楼栋挂到别家分区
        const zone = await this.dataSource
            .getRepository(CampusZone)
            .findOne({ where: { id: zoneId as any, channelId: ctx.channelId as any } });
        if (!zone) throw new UserInputError('分区不存在或不属于当前店铺');
        return this.dataSource.getRepository(CampusBuilding).save({
            name: buildingName,
            zoneId: Number(zoneId),
            detail: detail?.trim() || null,
            lat: normalizeCoord(lat, 'lat'),
            lng: normalizeCoord(lng, 'lng'),
            channelId: ctx.channelId,
        } as any);
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
        if (patch.name !== undefined) {
            const name = String(patch.name ?? '').trim();
            if (!name) throw new UserInputError('楼栋名称不能为空');
            building.name = name;
        }
        if (patch.detail !== undefined) building.detail = patch.detail;
        if (patch.lat !== undefined) building.lat = normalizeCoord(patch.lat, 'lat') as any;
        if (patch.lng !== undefined) building.lng = normalizeCoord(patch.lng, 'lng') as any;
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

    /** 允许后台写入的字段白名单：不含 channelId/id/createdAt 等身份列，
     * 防止渠道管理员通过 patch 注入主键或跨渠道绑定（resolver 入参为 any，服务层必须自守）。 */
    private static readonly WRITABLE_FIELDS = new Set<string>([
        'routesEnabled', 'riderCommissionRate', 'autoAssignMinutes', 'paused', 'autoRefundMinutes',
        'inProgressSlaMinutes', 'compensationCouponTemplateId', 'deliveryMinutes', 'minOrderAmount',
        'deliveryFee', 'storeAddress', 'storePhone', 'storeNotice', 'errandBaseFee', 'thirdPartyBaseFee',
        'freeShippingThreshold', 'merchantConfirmEnabled', 'merchantAutoOpenMinutes',
        'timeoutCompensationEnabled', 'timeoutGraceMinutes', 'timeoutCompensationWindowHours',
        'timeoutCompensationCouponTemplateId',
        'notifyTemplateAccepted', 'notifyTemplateRiderAssigned', 'notifyTemplateCookingDone',
        'notifyTemplateDelivered', 'notifyTemplateExceptionHandled', 'notifyTemplateOrderPlaced',
        'notifyTemplatePaymentPending', 'notifyTemplateCancelled', 'notifyTemplateAfterSales',
        'notifyTemplateAddressChanged', 'h5BaseUrl', 'printMode', 'routeFirstLeg', 'handoverPoints',
        'providerShopNo', 'merchantAcceptMinutes', 'externalPushTimeoutMinutes', 'externalFallbackMinutes',
        'storeLat', 'storeLng', 'dynamicPricing',
    ]);

    /** 整型配置的取值范围（分钟/百分比/分） */
    private static readonly INT_RANGES: Record<string, [number, number]> = {
        riderCommissionRate: [0, 100],
        autoAssignMinutes: [1, 120],
        autoRefundMinutes: [1, 240],
        inProgressSlaMinutes: [1, 240],
        merchantAutoOpenMinutes: [1, 240],
        merchantAcceptMinutes: [0, 240],
        externalPushTimeoutMinutes: [1, 240],
        externalFallbackMinutes: [1, 240],
        deliveryMinutes: [1, 240],
        minOrderAmount: [0, 100_000_00],
        deliveryFee: [0, 100_000_00],
        errandBaseFee: [0, 100_000_00],
        thirdPartyBaseFee: [0, 100_000_00],
        freeShippingThreshold: [0, 100_000_00],
    };

    async updateConfig(ctx: RequestContext, patch: Partial<CampusFulfillmentConfig>) {
        const cfg = await this.getConfig(ctx);
        const unknown = Object.keys(patch ?? {}).filter(k => !CampusConfigService.WRITABLE_FIELDS.has(k));
        if (unknown.length) {
            throw new UserInputError(`不支持的配置字段：${unknown.join(', ')}`);
        }
        // 数值字段统一强制取整 + 区间校验：防负数/小数/超大值把调度节奏改坏
        for (const [field, [min, max]] of Object.entries(CampusConfigService.INT_RANGES)) {
            if ((patch as any)[field] === undefined || (patch as any)[field] === null) continue;
            const v = Number((patch as any)[field]);
            if (!Number.isInteger(v) || v < min || v > max) {
                throw new UserInputError(`${field} 必须为 ${min}-${max} 的整数`);
            }
            (patch as any)[field] = v;
        }
        // 模板消息/域名等字符串字段做长度上限，防超长文本撑爆数据库列
        const stringLimits: Record<string, number> = {
            storeAddress: 200, storePhone: 32, storeNotice: 500, h5BaseUrl: 200,
            compensationCouponTemplateId: 128, timeoutCompensationCouponTemplateId: 128,
            notifyTemplateAccepted: 128, notifyTemplateRiderAssigned: 128, notifyTemplateCookingDone: 128,
            notifyTemplateDelivered: 128, notifyTemplateExceptionHandled: 128, notifyTemplateOrderPlaced: 128,
            notifyTemplatePaymentPending: 128, notifyTemplateCancelled: 128, notifyTemplateAfterSales: 128,
            notifyTemplateAddressChanged: 128,
        };
        for (const [field, limit] of Object.entries(stringLimits)) {
            const v = (patch as any)[field];
            if (typeof v === 'string' && v.length > limit) {
                throw new UserInputError(`${field} 长度不能超过 ${limit} 字符`);
            }
        }
        if (patch.routesEnabled !== undefined) {
            const routes = patch.routesEnabled;
            if (!Array.isArray(routes) || routes.some(r => !['R1', 'R2', 'R3', 'R4', 'R5'].includes(String(r)))) {
                throw new UserInputError('配送路线配置不合法');
            }
            patch.routesEnabled = Array.from(new Set(routes.map(r => String(r))));
        }
        if (patch.printMode !== undefined && patch.printMode !== null
            && !['off', 'onPaid', 'onAccepted'].includes(String(patch.printMode))) {
            throw new UserInputError('打印时机不合法');
        }
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
        const slotDate = normalizeSlotDate(input.slotDate);
        const startTime = normalizeSlotTime(input.startTime, '开始时间');
        const endTime = normalizeSlotTime(input.endTime, '结束时间');
        if (startTime >= endTime) throw new UserInputError('开始时间必须早于结束时间');
        const capacity = input.capacity == null ? 20 : normalizeCapacity(input.capacity);
        let zoneId: number | null = null;
        if (input.zoneId != null) {
            zoneId = Number(input.zoneId);
            const zone = await this.dataSource
                .getRepository(CampusZone)
                .findOne({ where: { id: zoneId as any, channelId: ctx.channelId as any } });
            if (!zone) throw new UserInputError('分区不存在或不属于当前店铺');
        }
        const repo = this.dataSource.getRepository(DeliverySlot);
        // 同店铺同日期同开始时间（同分区）已有生效时段 → 拒绝重复创建
        const dup = await repo.findOne({
            where: {
                channelId: ctx.channelId as any,
                slotDate,
                startTime,
                zoneId: zoneId as any,
                active: true,
            },
        });
        if (dup) throw new UserInputError('同一时段已存在，请勿重复创建');
        return repo.save({
            slotDate,
            startTime,
            endTime,
            zoneId,
            capacity,
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
        if (patch.capacity !== undefined) patch.capacity = normalizeCapacity(patch.capacity);
        const startTime = patch.startTime !== undefined
            ? normalizeSlotTime(patch.startTime, '开始时间')
            : slot.startTime;
        const endTime = patch.endTime !== undefined ? normalizeSlotTime(patch.endTime, '结束时间') : slot.endTime;
        if (startTime >= endTime) throw new UserInputError('开始时间必须早于结束时间');
        Object.assign(slot, patch, { startTime, endTime });
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
        // 本地时区口径（slotDate 是本地日期字符串，不能用 toISOString 的 UTC 日期比较，
        // 否则 00:00–08:00 会少显示/多显示一天）
        const now = new Date();
        const today = localDateStr(now);
        const hhmm = localHhmm(now);
        return slots
            .filter(s => s.active)
            .filter(s => s.slotDate > today || (s.slotDate === today && s.endTime > hhmm))
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
        // 跨店守卫：只能选本渠道分区/楼栋
        if (Number(zone.channelId) !== Number(ctx.channelId)) throw new UserInputError('分区不属于当前店铺');
        const building = await this.dataSource
            .getRepository(CampusBuilding)
            .findOne({ where: { id: buildingId as any } });
        if (!building) throw new UserInputError('宿舍楼不存在');
        if (Number(building.zoneId) !== Number(zone.id) || Number(building.channelId) !== Number(ctx.channelId)) {
            throw new UserInputError('楼栋不属于所选分区');
        }
        // R2 与 R1/R3 同走 zone/building 写入（R2 原单收宿舍楼信息供接力预填）；R4 不经骑手不落此链路
        if (route && !['R1', 'R2', 'R3'].includes(route)) throw new UserInputError('配送路线不合法');
        if (route) {
            // 路线开关校验：渠道关闭某路线后 C 端不能再下该路线的单（读不到配置按未启用处理）
            const cfgRepo = this.dataSource.getRepository(CampusFulfillmentConfig);
            const cfg = await cfgRepo?.findOne?.({ where: { channelId: ctx.channelId as any } });
            const enabled: string[] | undefined = cfg?.routesEnabled;
            if (!enabled || !enabled.includes(route)) {
                throw new UserInputError('该配送路线当前不可用');
            }
        }
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
            // 分区专属时段只能选对应分区（null=全分区通用）
            if (slot.zoneId != null && Number(slot.zoneId) !== Number(zone.id)) {
                throw new UserInputError('该时段不属于所选分区');
            }
            const now = new Date();
            const today = localDateStr(now);
            const hhmm = localHhmm(now);
            if (slot.slotDate < today || (slot.slotDate === today && slot.endTime <= hhmm)) {
                throw new UserInputError('时段已过期，请重新选择');
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
