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
exports.CampusConfigService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const delivery_slot_entity_1 = require("./delivery-slot.entity");
/** 本地日期 YYYY-MM-DD（slotDate 为本地日期字符串，勿用 UTC 的 toISOString） */
function localDateStr(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}
/** 本地 HH:mm，用于判断当天时段是否已结束 */
function localHhmm(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
let CampusConfigService = class CampusConfigService {
    constructor(dataSource, orderService) {
        this.dataSource = dataSource;
        this.orderService = orderService;
    }
    listZones(ctx) {
        return this.dataSource.getRepository(campus_zone_entity_1.CampusZone).find({ where: { channelId: ctx.channelId } });
    }
    async createZone(ctx, name, fee) {
        return this.dataSource.getRepository(campus_zone_entity_1.CampusZone).save({ name, fee, channelId: ctx.channelId });
    }
    /** 分区改名/改运费（渠道隔离）；分区名被历史订单快照引用，仅改当前配置不影响已下单 */
    async updateZone(ctx, id, patch) {
        const repo = this.dataSource.getRepository(campus_zone_entity_1.CampusZone);
        const zone = await repo.findOne({ where: { id: id, channelId: ctx.channelId } });
        if (!zone)
            throw new core_1.UserInputError('分区不存在');
        if (patch.name !== undefined) {
            const name = String(patch.name).trim();
            if (!name)
                throw new core_1.UserInputError('分区名称不能为空');
            zone.name = name;
        }
        if (patch.fee !== undefined) {
            const fee = Number(patch.fee);
            if (!Number.isInteger(fee) || fee < 0)
                throw new core_1.UserInputError('分区运费必须为非负整数（分）');
            zone.fee = fee;
        }
        return repo.save(zone);
    }
    /** 删除楼栋：仅当无订单引用（含历史指向该楼栋的订单）时允许，避免配送目标丢失 */
    async deleteBuilding(ctx, id) {
        const repo = this.dataSource.getRepository(campus_building_entity_1.CampusBuilding);
        const building = await repo.findOne({ where: { id: id, channelId: ctx.channelId } });
        if (!building)
            throw new core_1.UserInputError('宿舍楼不存在');
        const used = await this.dataSource
            .getRepository(core_1.Order)
            .createQueryBuilder('order')
            .where('order.customFields.buildingId = :bid', { bid: String(id) })
            .getCount();
        if (used > 0)
            throw new core_1.UserInputError(`该宿舍楼已有 ${used} 个订单引用，不能删除`);
        await repo.remove(building);
        return true;
    }
    /** 楼栋按当前渠道隔离：后台维护页与 C 端选楼都只读本渠道数据 */
    listBuildings(ctx, zoneId) {
        const where = { channelId: ctx.channelId };
        if (zoneId)
            where.zoneId = zoneId;
        return this.dataSource.getRepository(campus_building_entity_1.CampusBuilding).find({ where });
    }
    async createBuilding(ctx, name, zoneId, detail, lat, lng) {
        return this.dataSource
            .getRepository(campus_building_entity_1.CampusBuilding)
            .save({ name, zoneId, detail, lat, lng, channelId: ctx.channelId });
    }
    /** 楼栋信息/坐标维护（骑手跟踪页目标点）；仅更新传入字段 */
    async updateBuilding(ctx, id, patch) {
        const repo = this.dataSource.getRepository(campus_building_entity_1.CampusBuilding);
        // 渠道过滤：不允许跨店铺改别家楼栋
        const building = await repo.findOne({ where: { id: id, channelId: ctx.channelId } });
        if (!building)
            throw new core_1.UserInputError('宿舍楼不存在');
        if (patch.name !== undefined)
            building.name = patch.name;
        if (patch.detail !== undefined)
            building.detail = patch.detail;
        if (patch.lat !== undefined)
            building.lat = patch.lat;
        if (patch.lng !== undefined)
            building.lng = patch.lng;
        return repo.save(building);
    }
    async getConfig(ctx) {
        const repo = this.dataSource.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: ctx.channelId } });
        if (!cfg) {
            // 显式写入默认值（与实体列默认值一致），保证内存对象与 DB 默认一致
            cfg = await repo.save(new campus_fulfillment_config_entity_1.CampusFulfillmentConfig({
                channelId: ctx.channelId,
                routesEnabled: ['R1', 'R3', 'R4', 'R5'],
                riderCommissionRate: 100,
                autoAssignMinutes: 10,
                paused: false,
            }));
        }
        return cfg;
    }
    async updateConfig(ctx, patch) {
        const cfg = await this.getConfig(ctx);
        // 超时赔付（P2）：开启必须指定券模板；宽限非法值直接拒绝，不再静默回落默认 10 分钟
        if (patch.timeoutGraceMinutes != null) {
            const grace = Number(patch.timeoutGraceMinutes);
            if (!Number.isInteger(grace) || grace < 0 || grace > 240) {
                throw new core_1.UserInputError('超时宽限必须为 0-240 的整数（分钟）');
            }
            patch.timeoutGraceMinutes = grace;
        }
        // 赔付回扫窗口（P2）：1-168h，避免窗口过大把陈年旧单批量补赔
        if (patch.timeoutCompensationWindowHours != null) {
            const hours = Number(patch.timeoutCompensationWindowHours);
            if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
                throw new core_1.UserInputError('赔付回扫窗口必须为 1-168 的整数（小时）');
            }
            patch.timeoutCompensationWindowHours = hours;
        }
        const nextEnabled = patch.timeoutCompensationEnabled !== undefined ? !!patch.timeoutCompensationEnabled : cfg.timeoutCompensationEnabled;
        const nextTemplate = patch.timeoutCompensationCouponTemplateId !== undefined
            ? patch.timeoutCompensationCouponTemplateId
            : cfg.timeoutCompensationCouponTemplateId;
        if (nextEnabled && !nextTemplate) {
            throw new core_1.UserInputError('开启超时赔付前必须选择赔付券模板');
        }
        Object.assign(cfg, patch);
        return this.dataSource.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).save(cfg);
    }
    async createSlot(ctx, input) {
        var _a;
        return this.dataSource.getRepository(delivery_slot_entity_1.DeliverySlot).save({
            slotDate: input.slotDate,
            startTime: input.startTime,
            endTime: input.endTime,
            zoneId: input.zoneId != null ? Number(input.zoneId) : null,
            capacity: (_a = input.capacity) !== null && _a !== void 0 ? _a : 20,
            active: true,
            channelId: ctx.channelId,
        });
    }
    async updateSlot(ctx, id, patch) {
        const repo = this.dataSource.getRepository(delivery_slot_entity_1.DeliverySlot);
        // 渠道隔离：只能改本渠道时段（DeliverySlot.channelId 物理列，直接按标量查）
        const slot = await repo.findOne({ where: { id: id, channelId: ctx.channelId } });
        if (!slot)
            throw new core_1.UserInputError('时段不存在');
        Object.assign(slot, patch);
        return repo.save(slot);
    }
    async listSlots(ctx) {
        return this.dataSource.getRepository(delivery_slot_entity_1.DeliverySlot).find({
            where: { channelId: ctx.channelId },
            order: { slotDate: 'ASC', startTime: 'ASC' },
        });
    }
    /** C 端可订时段：active 且未过期，带余量 */
    async slotsForShop(ctx) {
        const slots = await this.dataSource.getRepository(delivery_slot_entity_1.DeliverySlot).find({
            where: { channelId: ctx.channelId, active: true },
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
            .map(s => (Object.assign(Object.assign({}, s), { remaining: Math.max(0, s.capacity - s.lockedCount) })))
            .filter(s => s.remaining > 0);
    }
    /** C 端选楼/选区/选路线/选时段写入 activeOrder。
     * route/slot 可选（向后兼容 plan2 旧调用形态）；route 为 R1/R2/R3；R2 的到校确认走 r2-mark 链路。 */
    async setDeliveryTarget(ctx, zoneId, buildingId, route, slotId) {
        var _a;
        const zone = await this.dataSource.getRepository(campus_zone_entity_1.CampusZone).findOne({ where: { id: zoneId } });
        if (!zone)
            throw new core_1.UserInputError('分区不存在');
        // 跨店守卫：只能选本渠道分区/楼栋
        if (Number(zone.channelId) !== Number(ctx.channelId))
            throw new core_1.UserInputError('分区不属于当前店铺');
        const building = await this.dataSource
            .getRepository(campus_building_entity_1.CampusBuilding)
            .findOne({ where: { id: buildingId } });
        if (!building)
            throw new core_1.UserInputError('宿舍楼不存在');
        if (Number(building.zoneId) !== Number(zone.id) || Number(building.channelId) !== Number(ctx.channelId)) {
            throw new core_1.UserInputError('楼栋不属于所选分区');
        }
        // R2 与 R1/R3 同走 zone/building 写入（R2 原单收宿舍楼信息供接力预填）；R4 不经骑手不落此链路
        if (route && !['R1', 'R2', 'R3'].includes(route))
            throw new core_1.UserInputError('配送路线不合法');
        const fields = {
            buildingId: String(buildingId),
            campusZone: zone.name,
        };
        if (route)
            fields.fulfillmentRoute = route;
        if (slotId != null) {
            const slot = await this.dataSource.getRepository(delivery_slot_entity_1.DeliverySlot).findOne({ where: { id: slotId } });
            if (!slot || !slot.active || Number(slot.channelId) !== Number(ctx.channelId)) {
                throw new core_1.UserInputError('时段不可用');
            }
            const now = new Date();
            const today = localDateStr(now);
            const hhmm = localHhmm(now);
            if (slot.slotDate < today || (slot.slotDate === today && slot.endTime <= hhmm)) {
                throw new core_1.UserInputError('时段已过期，请重新选择');
            }
            if (slot.lockedCount >= slot.capacity)
                throw new core_1.UserInputError('该时段已满');
            fields.deliverySlotId = String(slotId);
            fields.deliverySlotText = `${slot.slotDate} ${slot.startTime}-${slot.endTime}`;
            // 预约锚点 = 时段开始时间（本地时区解析，plan 3.1）；调度 job 于该时点前 30min 放量
            fields.scheduledFor = new Date(`${slot.slotDate}T${slot.startTime}:00`);
        }
        else {
            // 切回「尽快送」：清空残留时段与预约锚点，避免旧值误触发预约调度
            fields.deliverySlotId = null;
            fields.deliverySlotText = null;
            fields.scheduledFor = null;
        }
        const orderId = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.activeOrderId;
        if (!orderId)
            throw new core_1.UserInputError('购物车为空');
        // 与 core shop setOrderCustomFields mutation 内部实现等价（patchEntity + 保存 + OrderEvent）
        return this.orderService.updateCustomFields(ctx, orderId, fields);
    }
};
exports.CampusConfigService = CampusConfigService;
exports.CampusConfigService = CampusConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource, core_1.OrderService])
], CampusConfigService);
//# sourceMappingURL=campus-config.service.js.map