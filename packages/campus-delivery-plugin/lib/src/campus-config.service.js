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
var CampusConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusConfigService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const delivery_slot_entity_1 = require("./delivery-slot.entity");
const delivery_fee_tiers_1 = require("./delivery-fee-tiers");
const closure_calendar_1 = require("./closure-calendar");
const route_matrix_1 = require("./route-matrix");
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
const SLOT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** 时段入参校验（create/update 共用）：日期/时刻格式 + 起止先后 */
function normalizeSlotDate(v) {
    const s = String(v !== null && v !== void 0 ? v : '').trim();
    if (!SLOT_DATE_RE.test(s))
        throw new core_1.UserInputError('日期格式必须为 YYYY-MM-DD');
    return s;
}
function normalizeSlotTime(v, label) {
    const s = String(v !== null && v !== void 0 ? v : '').trim();
    if (!SLOT_TIME_RE.test(s))
        throw new core_1.UserInputError(`${label}格式必须为 HH:mm`);
    return s;
}
function normalizeCapacity(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 9999)
        throw new core_1.UserInputError('时段容量必须为 1-9999 的整数');
    return n;
}
/** 经纬度范围校验（未传返回 null） */
function normalizeCoord(v, kind) {
    if (v == null || v === '')
        return null;
    const n = Number(v);
    if (!Number.isFinite(n) || (kind === 'lat' ? Math.abs(n) > 90 : Math.abs(n) > 180)) {
        throw new core_1.UserInputError(kind === 'lat' ? '纬度必须在 -90~90 之间' : '经度必须在 -180~180 之间');
    }
    return n;
}
let CampusConfigService = CampusConfigService_1 = class CampusConfigService {
    constructor(dataSource, orderService) {
        this.dataSource = dataSource;
        this.orderService = orderService;
    }
    listZones(ctx) {
        return this.dataSource.getRepository(campus_zone_entity_1.CampusZone).find({ where: { channelId: ctx.channelId } });
    }
    async createZone(ctx, name, fee) {
        const zoneName = String(name !== null && name !== void 0 ? name : '').trim();
        if (!zoneName)
            throw new core_1.UserInputError('分区名称不能为空');
        const zoneFee = Number(fee);
        if (!Number.isInteger(zoneFee) || zoneFee < 0)
            throw new core_1.UserInputError('分区运费必须为非负整数（分）');
        return this.dataSource.getRepository(campus_zone_entity_1.CampusZone).save({ name: zoneName, fee: zoneFee, channelId: ctx.channelId });
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
        const buildingName = String(name !== null && name !== void 0 ? name : '').trim();
        if (!buildingName)
            throw new core_1.UserInputError('楼栋名称不能为空');
        // 分区必须属于当前店铺，防止把楼栋挂到别家分区
        const zone = await this.dataSource
            .getRepository(campus_zone_entity_1.CampusZone)
            .findOne({ where: { id: zoneId, channelId: ctx.channelId } });
        if (!zone)
            throw new core_1.UserInputError('分区不存在或不属于当前店铺');
        return this.dataSource.getRepository(campus_building_entity_1.CampusBuilding).save({
            name: buildingName,
            zoneId: Number(zoneId),
            detail: (detail === null || detail === void 0 ? void 0 : detail.trim()) || null,
            lat: normalizeCoord(lat, 'lat'),
            lng: normalizeCoord(lng, 'lng'),
            channelId: ctx.channelId,
        });
    }
    /** 楼栋信息/坐标维护（骑手跟踪页目标点）；仅更新传入字段 */
    async updateBuilding(ctx, id, patch) {
        var _a;
        const repo = this.dataSource.getRepository(campus_building_entity_1.CampusBuilding);
        // 渠道过滤：不允许跨店铺改别家楼栋
        const building = await repo.findOne({ where: { id: id, channelId: ctx.channelId } });
        if (!building)
            throw new core_1.UserInputError('宿舍楼不存在');
        if (patch.name !== undefined) {
            const name = String((_a = patch.name) !== null && _a !== void 0 ? _a : '').trim();
            if (!name)
                throw new core_1.UserInputError('楼栋名称不能为空');
            building.name = name;
        }
        if (patch.detail !== undefined)
            building.detail = patch.detail;
        if (patch.lat !== undefined)
            building.lat = normalizeCoord(patch.lat, 'lat');
        if (patch.lng !== undefined)
            building.lng = normalizeCoord(patch.lng, 'lng');
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
        var _a;
        const cfg = await this.getConfig(ctx);
        const unknown = Object.keys(patch !== null && patch !== void 0 ? patch : {}).filter(k => !CampusConfigService_1.WRITABLE_FIELDS.has(k));
        if (unknown.length) {
            throw new core_1.UserInputError(`不支持的配置字段：${unknown.join(', ')}`);
        }
        // 数值字段统一强制取整 + 区间校验：防负数/小数/超大值把调度节奏改坏
        for (const [field, [min, max]] of Object.entries(CampusConfigService_1.INT_RANGES)) {
            if (patch[field] === undefined || patch[field] === null)
                continue;
            const v = Number(patch[field]);
            if (!Number.isInteger(v) || v < min || v > max) {
                throw new core_1.UserInputError(`${field} 必须为 ${min}-${max} 的整数`);
            }
            patch[field] = v;
        }
        // 模板消息/域名等字符串字段做长度上限，防超长文本撑爆数据库列
        const stringLimits = {
            storeAddress: 200, storePhone: 32, storeNotice: 500, h5BaseUrl: 200,
            compensationCouponTemplateId: 128, timeoutCompensationCouponTemplateId: 128,
            notifyTemplateAccepted: 128, notifyTemplateRiderAssigned: 128, notifyTemplateCookingDone: 128,
            notifyTemplateDelivered: 128, notifyTemplateExceptionHandled: 128, notifyTemplateOrderPlaced: 128,
            notifyTemplatePaymentPending: 128, notifyTemplateCancelled: 128, notifyTemplateAfterSales: 128,
            notifyTemplateAddressChanged: 128,
            unmannedDeliveryEndpoint: 255, unmannedDeliveryKey: 128,
        };
        for (const [field, limit] of Object.entries(stringLimits)) {
            const v = patch[field];
            if (typeof v === 'string' && v.length > limit) {
                throw new core_1.UserInputError(`${field} 长度不能超过 ${limit} 字符`);
            }
        }
        if (patch.routesEnabled !== undefined) {
            const routes = patch.routesEnabled;
            if (!Array.isArray(routes) || routes.some(r => !['R1', 'R2', 'R3', 'R4', 'R5'].includes(String(r)))) {
                throw new core_1.UserInputError('配送路线配置不合法');
            }
            patch.routesEnabled = Array.from(new Set(routes.map(r => String(r))));
        }
        // 休业日历（§70）：写入前严格校验（真实日期 / 不早于今天 / 最多提前 90 天 / 最多 30 条）
        if (patch.closureDates !== undefined) {
            try {
                patch.closureDates = (0, closure_calendar_1.normalizeClosureDates)(patch.closureDates);
            }
            catch (e) {
                throw new core_1.UserInputError((e === null || e === void 0 ? void 0 : e.message) || '休业日历不合法');
            }
        }
        // 自动接单适用范围（§69）：只接受 R1/R2/R3，空数组回落全部（不允许一条路线都不选）
        if (patch.autoAcceptRoutes !== undefined && patch.autoAcceptRoutes !== null) {
            const list = Array.isArray(patch.autoAcceptRoutes)
                ? patch.autoAcceptRoutes
                : String(patch.autoAcceptRoutes).split(',');
            const picked = list.map(r => String(r !== null && r !== void 0 ? r : '').trim().toUpperCase()).filter(Boolean);
            if (picked.some(r => !['R1', 'R2', 'R3'].includes(r))) {
                throw new core_1.UserInputError('自动接单适用范围不合法（仅支持 R1/R2/R3）');
            }
            patch.autoAcceptRoutes = picked.length ? Array.from(new Set(picked)) : ['R1', 'R2', 'R3'];
        }
        if (patch.printMode !== undefined && patch.printMode !== null
            && !['off', 'onPaid', 'onAccepted'].includes(String(patch.printMode))) {
            throw new core_1.UserInputError('打印时机不合法');
        }
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
        // 超时赔付（P2）：仅在本次修改触碰赔付字段时校验「开启必须有券模板」，
        // 否则存量「开启但缺模板」的渠道任何无关配置（营业开关/公告/自动接单）都会被连带拒绝
        const touchesCompensation = patch.timeoutCompensationEnabled !== undefined
            || patch.timeoutCompensationCouponTemplateId !== undefined;
        if (touchesCompensation) {
            const nextEnabled = patch.timeoutCompensationEnabled !== undefined ? !!patch.timeoutCompensationEnabled : cfg.timeoutCompensationEnabled;
            const nextTemplate = patch.timeoutCompensationCouponTemplateId !== undefined
                ? patch.timeoutCompensationCouponTemplateId
                : cfg.timeoutCompensationCouponTemplateId;
            if (nextEnabled && !nextTemplate) {
                throw new core_1.UserInputError('开启超时赔付前必须选择赔付券模板');
            }
        }
        // 坐标（P2）：非法经纬度会让导航/取货点失效且前端无感，直接拒绝
        for (const [field, limit] of [['storeLat', 90], ['storeLng', 180]]) {
            const v = patch[field];
            if (v === undefined || v === null)
                continue;
            const num = Number(v);
            if (!Number.isFinite(num) || Math.abs(num) > limit) {
                throw new core_1.UserInputError(`${field} 必须是合法的${field === 'storeLat' ? '纬' : '经'}度`);
            }
            patch[field] = num;
        }
        // 结构化配置（P2）：必须是对象，防字符串/数组写法把 JSON 列写坏导致交接点/计价静默失效
        for (const field of ['routeFirstLeg', 'providerShopNo', 'dynamicPricing']) {
            const v = patch[field];
            if (v !== undefined && v !== null && (typeof v !== 'object' || Array.isArray(v))) {
                throw new core_1.UserInputError(`${field} 必须是对象`);
            }
        }
        // 配送费阶梯（P3-4）：接受数组或 JSON 字符串，统一严格校验后存数组
        if (patch.deliveryFeeTiers !== undefined) {
            try {
                const raw = typeof patch.deliveryFeeTiers === 'string'
                    ? (String(patch.deliveryFeeTiers).trim() ? JSON.parse(patch.deliveryFeeTiers) : null)
                    : patch.deliveryFeeTiers;
                patch.deliveryFeeTiers = (0, delivery_fee_tiers_1.normalizeDeliveryFeeTiers)(raw);
            }
            catch (e) {
                throw new core_1.UserInputError((e === null || e === void 0 ? void 0 : e.message) || '配送费阶梯不合法');
            }
        }
        if (patch.handoverPoints !== undefined && patch.handoverPoints !== null) {
            const points = patch.handoverPoints;
            if (typeof points !== 'object' || Array.isArray(points)) {
                throw new core_1.UserInputError('handoverPoints 必须是对象');
            }
            for (const [route, list] of Object.entries(points)) {
                if (!Array.isArray(list))
                    throw new core_1.UserInputError(`交接点 ${route} 必须是数组`);
                for (const p of list) {
                    if (!p || typeof p !== 'object'
                        || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) {
                        throw new core_1.UserInputError(`交接点 ${route} 坐标不合法`);
                    }
                }
            }
        }
        // 路线完备性（P1/#2）：R1/R2 恒走「校园交接点 + 传信者接力」，缺交接点会在支付后静默降级为
        // 传信者到店直送（campusCause=no_handover_point），但运费仍按 R1/R2 收。
        // 放在交接点结构校验之后，保证非法结构优先报结构错误；
        // 仅在本次修改触碰路线或前置配置时校验，避免存量渠道改公告等无关字段被连带拒绝。
        const touchesRoutePrereq = patch.routesEnabled !== undefined
            || patch.storeLat !== undefined || patch.storeLng !== undefined
            || patch.handoverPoints !== undefined;
        const nextRoutes = (patch.routesEnabled !== undefined ? patch.routesEnabled : (_a = cfg.routesEnabled) !== null && _a !== void 0 ? _a : []);
        if (touchesRoutePrereq && nextRoutes.includes('R1')) {
            const points = patch.handoverPoints !== undefined ? patch.handoverPoints : cfg.handoverPoints;
            if (!(0, route_matrix_1.listHandoverPoints)('R1', { handoverPoints: points }).length) {
                throw new core_1.UserInputError('启用 R1 前必须配置 R1 校园交接点（名称与经纬度）');
            }
        }
        if (touchesRoutePrereq && nextRoutes.includes('R2')) {
            const lat = patch.storeLat !== undefined ? patch.storeLat : cfg.storeLat;
            const lng = patch.storeLng !== undefined ? patch.storeLng : cfg.storeLng;
            if (lat == null || lng == null) {
                throw new core_1.UserInputError('启用 R2 前必须填写门店取货点经纬度');
            }
            const points = patch.handoverPoints !== undefined ? patch.handoverPoints : cfg.handoverPoints;
            if (!(0, route_matrix_1.listHandoverPoints)('R2', { handoverPoints: points }).length) {
                throw new core_1.UserInputError('启用 R2 前必须配置 R2 校园交接点（名称与经纬度）');
            }
        }
        Object.assign(cfg, patch);
        return this.dataSource.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).save(cfg);
    }
    async createSlot(ctx, input) {
        const slotDate = normalizeSlotDate(input.slotDate);
        const startTime = normalizeSlotTime(input.startTime, '开始时间');
        const endTime = normalizeSlotTime(input.endTime, '结束时间');
        if (startTime >= endTime)
            throw new core_1.UserInputError('开始时间必须早于结束时间');
        const capacity = input.capacity == null ? 20 : normalizeCapacity(input.capacity);
        let zoneId = null;
        if (input.zoneId != null) {
            zoneId = Number(input.zoneId);
            const zone = await this.dataSource
                .getRepository(campus_zone_entity_1.CampusZone)
                .findOne({ where: { id: zoneId, channelId: ctx.channelId } });
            if (!zone)
                throw new core_1.UserInputError('分区不存在或不属于当前店铺');
        }
        const repo = this.dataSource.getRepository(delivery_slot_entity_1.DeliverySlot);
        // 同店铺同日期同开始时间（同分区）已有生效时段 → 拒绝重复创建
        const dup = await repo.findOne({
            where: {
                channelId: ctx.channelId,
                slotDate,
                startTime,
                zoneId: zoneId,
                active: true,
            },
        });
        if (dup)
            throw new core_1.UserInputError('同一时段已存在，请勿重复创建');
        return repo.save({
            slotDate,
            startTime,
            endTime,
            zoneId,
            capacity,
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
        if (patch.capacity !== undefined)
            patch.capacity = normalizeCapacity(patch.capacity);
        const startTime = patch.startTime !== undefined
            ? normalizeSlotTime(patch.startTime, '开始时间')
            : slot.startTime;
        const endTime = patch.endTime !== undefined ? normalizeSlotTime(patch.endTime, '结束时间') : slot.endTime;
        if (startTime >= endTime)
            throw new core_1.UserInputError('开始时间必须早于结束时间');
        Object.assign(slot, patch, { startTime, endTime });
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
        var _a, _b;
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
        if (route) {
            // 路线开关校验：渠道关闭某路线后 C 端不能再下该路线的单（读不到配置按未启用处理）
            const cfgRepo = this.dataSource.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig);
            const cfg = await cfgRepo.findOne({ where: { channelId: ctx.channelId } });
            const enabled = cfg === null || cfg === void 0 ? void 0 : cfg.routesEnabled;
            if (!cfg || !enabled || !enabled.includes(route)) {
                throw new core_1.UserInputError('该配送路线当前不可用');
            }
            // R1/R2 派单前置（P1）：缺对应路线交接点时提前拦截，避免支付后才降级为传信者到店直送
            // （运费仍按 R1/R2 收、时效承诺失真）。R1 只需交接点；R2 还必须有门店取货坐标。
            if (route === 'R1' && !(0, route_matrix_1.listHandoverPoints)('R1', cfg).length) {
                throw new core_1.UserInputError('该配送路线当前不可用');
            }
            if (route === 'R2') {
                if (cfg.storeLat == null || cfg.storeLng == null) {
                    throw new core_1.UserInputError('该配送路线当前不可用');
                }
                if (!(0, route_matrix_1.listHandoverPoints)('R2', cfg).length) {
                    throw new core_1.UserInputError('该配送路线当前不可用');
                }
            }
        }
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
            // 分区专属时段只能选对应分区（null=全分区通用）
            if (slot.zoneId != null && Number(slot.zoneId) !== Number(zone.id)) {
                throw new core_1.UserInputError('该时段不属于所选分区');
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
        const updated = await this.orderService.updateCustomFields(ctx, orderId, fields);
        // 结算顺序解耦（P1）：配送方式可能在选楼栋/路线之前就已落账，改地址后运费会滞留旧价。
        // 仅在尚可改单的 AddingItems 下重算（ArrangingPayment 的金额已进入支付流程，Vendure 禁止再改）；
        // 若已选方式不适用于新分区/路线，则清空要求重选，避免用户按旧运费继续支付。
        if (updated.state !== 'AddingItems' || !((_b = updated.shippingLines) === null || _b === void 0 ? void 0 : _b.length))
            return updated;
        const methodId = updated.shippingLines[0].shippingMethodId;
        if (methodId == null)
            return updated;
        const recalculated = await this.orderService.setShippingMethod(ctx, orderId, [methodId]);
        if ((0, core_1.isGraphQlErrorResult)(recalculated)) {
            await this.orderService.setShippingMethod(ctx, orderId, []);
            throw new core_1.UserInputError('所选配送方式不适用于该地址/路线，请重新选择配送方式');
        }
        return recalculated;
    }
};
exports.CampusConfigService = CampusConfigService;
/** 允许后台写入的字段白名单：不含 channelId/id/createdAt 等身份列，
 * 防止渠道管理员通过 patch 注入主键或跨渠道绑定（resolver 入参为 any，服务层必须自守）。 */
CampusConfigService.WRITABLE_FIELDS = new Set([
    'routesEnabled', 'riderCommissionRate', 'autoAssignMinutes', 'paused', 'autoRefundMinutes',
    'inProgressSlaMinutes', 'compensationCouponTemplateId', 'deliveryMinutes', 'minOrderAmount',
    'deliveryFee', 'storeAddress', 'storePhone', 'storeNotice', 'errandBaseFee', 'thirdPartyBaseFee',
    'freeShippingThreshold', 'deliveryFeeTiers', 'merchantConfirmEnabled', 'merchantAutoOpenMinutes',
    'autoAcceptEnabled', 'autoAcceptDelaySeconds', 'autoAcceptDailyLimit', 'autoAcceptRoutes',
    'closureDates',
    'timeoutCompensationEnabled', 'timeoutGraceMinutes', 'timeoutCompensationWindowHours',
    'timeoutCompensationCouponTemplateId',
    'notifyTemplateAccepted', 'notifyTemplateRiderAssigned', 'notifyTemplateCookingDone',
    'notifyTemplateDelivered', 'notifyTemplateExceptionHandled', 'notifyTemplateOrderPlaced',
    'notifyTemplatePaymentPending', 'notifyTemplateCancelled', 'notifyTemplateAfterSales',
    'notifyTemplateAddressChanged', 'h5BaseUrl', 'printMode', 'routeFirstLeg', 'handoverPoints',
    'providerShopNo', 'merchantAcceptMinutes', 'externalPushTimeoutMinutes', 'externalFallbackMinutes',
    'storeLat', 'storeLng', 'dynamicPricing', 'shiftCheckEnabled', 'blacklistAutoCancelCount',
    // P2-4 无人配送通道（接口占位）
    'unmannedDeliveryEnabled', 'unmannedDeliveryProvider', 'unmannedDeliveryEndpoint', 'unmannedDeliveryKey',
]);
/** 整型配置的取值范围（分钟/百分比/分） */
CampusConfigService.INT_RANGES = {
    riderCommissionRate: [0, 100],
    autoAssignMinutes: [1, 120],
    autoRefundMinutes: [1, 240],
    inProgressSlaMinutes: [1, 240],
    merchantAutoOpenMinutes: [1, 240],
    autoAcceptDelaySeconds: [0, 600],
    autoAcceptDailyLimit: [0, 999],
    merchantAcceptMinutes: [0, 240],
    externalPushTimeoutMinutes: [1, 240],
    externalFallbackMinutes: [1, 240],
    deliveryMinutes: [1, 240],
    minOrderAmount: [0, 10000000],
    deliveryFee: [0, 10000000],
    errandBaseFee: [0, 10000000],
    thirdPartyBaseFee: [0, 10000000],
    freeShippingThreshold: [0, 10000000],
    blacklistAutoCancelCount: [0, 50],
};
exports.CampusConfigService = CampusConfigService = CampusConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource, core_1.OrderService])
], CampusConfigService);
//# sourceMappingURL=campus-config.service.js.map