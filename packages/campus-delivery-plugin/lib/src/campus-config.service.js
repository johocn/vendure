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
    listBuildings(zoneId) {
        return this.dataSource
            .getRepository(campus_building_entity_1.CampusBuilding)
            .find(zoneId ? { where: { zoneId } } : {});
    }
    async createBuilding(ctx, name, zoneId, detail) {
        return this.dataSource
            .getRepository(campus_building_entity_1.CampusBuilding)
            .save({ name, zoneId, detail, channelId: ctx.channelId });
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
        const slot = await repo.findOne({ where: { id: id } });
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
        const today = new Date().toISOString().slice(0, 10);
        return slots
            .filter(s => s.active)
            .filter(s => s.slotDate >= today)
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
        const building = await this.dataSource
            .getRepository(campus_building_entity_1.CampusBuilding)
            .findOne({ where: { id: buildingId } });
        if (!building)
            throw new core_1.UserInputError('宿舍楼不存在');
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