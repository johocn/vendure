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
exports.VirtualPhysicalStockService = void 0;
exports.normalizeDeliveryMethods = normalizeDeliveryMethods;
exports.normalizeCities = normalizeCities;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const typeorm_1 = require("typeorm");
const variant_location_binding_entity_1 = require("./variant-location-binding.entity");
const stock_reservation_item_entity_1 = require("./stock-reservation-item.entity");
const mirror_math_1 = require("./mirror-math");
const stock_city_filter_1 = require("./stock-city-filter");
const delivery_methods_1 = require("./delivery-methods");
const delivery_record_service_1 = require("../delivery/delivery-record.service");
const loggerCtx = 'VirtualPhysicalStockService';
const DELIVERY_METHODS = ['MAIL', 'SELF_PICKUP'];
/** 配送方式归一：只收白名单取值、去重；空数组 → null（null 语义 = 邮寄与自提都支持） */
function normalizeDeliveryMethods(input) {
    const out = [
        ...new Set((input !== null && input !== void 0 ? input : [])
            .map(v => String(v !== null && v !== void 0 ? v : '').trim().toUpperCase())
            .filter(v => DELIVERY_METHODS.includes(v))),
    ];
    return out.length ? out : null;
}
/** 服务城市归一：去空去重；空 → null（null 语义 = 全国可达） */
function normalizeCities(input) {
    const out = [...new Set((input !== null && input !== void 0 ? input : []).map(v => String(v !== null && v !== void 0 ? v : '').trim()).filter(Boolean))];
    return out.length ? out : null;
}
let VirtualPhysicalStockService = class VirtualPhysicalStockService {
    constructor(connection, stockLocationService, stockLevelService, inventoryService, eventBus, deliveryRecordService) {
        this.connection = connection;
        this.stockLocationService = stockLocationService;
        this.stockLevelService = stockLevelService;
        this.inventoryService = inventoryService;
        this.eventBus = eventBus;
        this.deliveryRecordService = deliveryRecordService;
    }
    virtualCode(channelCode) {
        return `${channelCode}-virtual`;
    }
    /** 系统仓：默认物理仓（code=租户编码）与虚拟仓（code=租户编码-virtual）——不可改码、不可删除 */
    isSystemLocationCode(channelCode, code) {
        return !!code && (code === channelCode || code === this.virtualCode(channelCode));
    }
    async findLocationByCode(ctx, code) {
        return this.connection
            .getRepository(ctx, core_1.StockLocation)
            .createQueryBuilder('loc')
            .where('loc.customFields.code = :code', { code })
            .getOne();
    }
    /**
     * 仓归属校验：channelCode 命中、或 code 等于租户编码 / `{租户编码}-*` 前缀。
     * 两者皆空的历史数据视为「当前渠道内未打标」，按可见即归属处理（否则旧网点会凭空消失）。
     */
    codeBelongsToTenant(channelCode, cf) {
        var _a, _b;
        const code = String((_a = cf === null || cf === void 0 ? void 0 : cf.code) !== null && _a !== void 0 ? _a : '');
        const owner = String((_b = cf === null || cf === void 0 ? void 0 : cf.channelCode) !== null && _b !== void 0 ? _b : '');
        if (owner && owner !== channelCode) {
            return false;
        }
        if (!code) {
            return true;
        }
        return code === channelCode || code === this.virtualCode(channelCode) || code.startsWith(`${channelCode}-`);
    }
    /** 当前渠道可见的仓（channel-aware，天然排除其它租户渠道的仓） */
    async channelLocations(ctx) {
        const { items } = await this.stockLocationService.findAll(ctx, { take: 500 });
        return items;
    }
    /** 系统仓自愈：kind/code/channelCode 与规格不符时按规格回写（幂等，不触碰其它字段） */
    async patchSystemLocation(ctx, loc, kind, code, channelCode) {
        var _a;
        const cf = (_a = loc.customFields) !== null && _a !== void 0 ? _a : {};
        if (cf.kind === kind && cf.code === code && cf.channelCode === channelCode) {
            return loc;
        }
        loc.customFields = Object.assign(Object.assign({}, cf), { kind, code, channelCode });
        return this.connection.getRepository(ctx, core_1.StockLocation).save(loc);
    }
    async ensureVirtualLocation(ctx, channel = ctx.channel) {
        const code = this.virtualCode(channel.code);
        const existing = await this.findLocationByCode(ctx, code);
        if (existing) {
            return this.patchSystemLocation(ctx, existing, 'virtual', code, channel.code);
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${channel.code} 虚拟仓`,
            description: '网络销售可售源（系统自动创建）',
            customFields: { kind: 'virtual', code, channelCode: channel.code },
        });
        core_1.Logger.info(`虚拟仓已创建: ${code}`, loggerCtx);
        return loc;
    }
    async ensureDefaultPhysicalLocation(ctx, channel = ctx.channel) {
        const code = channel.code;
        const existing = await this.findLocationByCode(ctx, code);
        if (existing) {
            return this.patchSystemLocation(ctx, existing, 'physical', code, channel.code);
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${channel.code} 默认仓`,
            description: '物理库存默认仓（开启物理库存时自动创建）',
            customFields: { kind: 'physical', code, channelCode: channel.code },
        });
        core_1.Logger.info(`默认物理仓已创建: ${code}`, loggerCtx);
        return loc;
    }
    /** 租户库存方案概览：开关口径 + 系统仓落点 + 本租户仓清单（web-admin「库存网点」唯一数据源） */
    async getTenantInventoryOverview(ctx, channel = ctx.channel) {
        var _a, _b, _c, _d, _e;
        const prefix = channel.code;
        const virtualCode = this.virtualCode(prefix);
        const locations = (await this.channelLocations(ctx))
            .filter(l => { var _a; return this.codeBelongsToTenant(prefix, (_a = l.customFields) !== null && _a !== void 0 ? _a : {}); })
            .map(l => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const cf = (_a = l.customFields) !== null && _a !== void 0 ? _a : {};
            const code = String((_b = cf.code) !== null && _b !== void 0 ? _b : '');
            return {
                id: String(l.id),
                name: (_c = l.name) !== null && _c !== void 0 ? _c : '',
                code,
                kind: String((_d = cf.kind) !== null && _d !== void 0 ? _d : 'virtual'),
                isSystem: this.isSystemLocationCode(prefix, code),
                deliveryMethods: ((_e = cf.deliveryMethods) !== null && _e !== void 0 ? _e : null),
                serviceCities: ((_f = cf.serviceCities) !== null && _f !== void 0 ? _f : null),
                lat: (_g = cf.lat) !== null && _g !== void 0 ? _g : null,
                lng: (_h = cf.lng) !== null && _h !== void 0 ? _h : null,
            };
        })
            // 默认物理仓置顶，其余按编码排序（空编码=历史数据排最后）
            .sort((a, b) => {
            const rank = (c) => (c === prefix ? 0 : c === virtualCode ? 1 : c ? 2 : 3);
            const dr = rank(a.code) - rank(b.code);
            return dr !== 0 ? dr : a.code.localeCompare(b.code);
        });
        return {
            channelCode: prefix,
            physicalStockEnabled: Boolean((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.physicalStockEnabled),
            virtualCode,
            virtualLocationId: (_c = (_b = locations.find(l => l.code === virtualCode)) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : null,
            defaultPhysicalCode: prefix,
            defaultPhysicalLocationId: (_e = (_d = locations.find(l => l.code === prefix)) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : null,
            locations,
        };
    }
    /** 幂等补建系统仓：虚拟仓恒在；开关开启时补默认物理仓。返回概览供前端直接刷新 */
    async ensureTenantInventoryLocations(ctx, channel = ctx.channel) {
        var _a;
        await this.ensureVirtualLocation(ctx, channel);
        if (Boolean((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.physicalStockEnabled)) {
            await this.ensureDefaultPhysicalLocation(ctx, channel);
        }
        return this.getTenantInventoryOverview(ctx, channel);
    }
    /** 租户内下一个附加物理仓编码：`{租户编码}-{两位序号}`，占用则顺延 */
    async nextTenantLocationCode(ctx, channelCode) {
        var _a, _b;
        const used = new Set();
        for (const l of await this.channelLocations(ctx)) {
            const code = String((_b = ((_a = l.customFields) !== null && _a !== void 0 ? _a : {}).code) !== null && _b !== void 0 ? _b : '');
            if (code.startsWith(`${channelCode}-`)) {
                used.add(code.slice(channelCode.length + 1));
            }
        }
        for (let i = 1; i <= 999; i++) {
            const seq = String(i).padStart(2, '0');
            if (!used.has(seq)) {
                return `${channelCode}-${seq}`;
            }
        }
        throw new core_1.UserInputError(`租户 ${channelCode} 的仓库编码已达上限（999 个）`);
    }
    /** 取当前渠道可见且归属本租户的仓（越权/跨租户一律拒绝） */
    async findTenantLocation(ctx, channelCode, id) {
        var _a;
        const loc = (await this.channelLocations(ctx)).find(l => String(l.id) === String(id));
        if (!loc) {
            throw new core_1.UserInputError('仓库不存在或不属于当前渠道');
        }
        if (!this.codeBelongsToTenant(channelCode, (_a = loc.customFields) !== null && _a !== void 0 ? _a : {})) {
            throw new core_1.UserInputError('仓库不属于当前租户');
        }
        return loc;
    }
    /**
     * 新建租户物理仓。编码与性质由服务端生成（`{租户编码}-{两位序号}` / physical），
     * 归属强制落当前租户——前端不可指定，避免出现「无编码/非物理仓」而无法绑定变体的仓。
     */
    async createTenantPhysicalLocation(ctx, input, channel = ctx.channel) {
        var _a, _b, _c;
        const name = String((_a = input === null || input === void 0 ? void 0 : input.name) !== null && _a !== void 0 ? _a : '').trim();
        if (!name) {
            throw new core_1.UserInputError('仓库名称不能为空');
        }
        const code = await this.nextTenantLocationCode(ctx, channel.code);
        await this.stockLocationService.create(ctx, {
            name,
            description: '租户物理仓（自动编码）',
            customFields: {
                kind: 'physical',
                code,
                channelCode: channel.code,
                deliveryMethods: normalizeDeliveryMethods(input === null || input === void 0 ? void 0 : input.deliveryMethods),
                serviceCities: normalizeCities(input === null || input === void 0 ? void 0 : input.serviceCities),
                lat: (_b = input === null || input === void 0 ? void 0 : input.lat) !== null && _b !== void 0 ? _b : null,
                lng: (_c = input === null || input === void 0 ? void 0 : input.lng) !== null && _c !== void 0 ? _c : null,
            },
        });
        core_1.Logger.info(`租户物理仓已创建: ${code}`, loggerCtx);
        return this.getTenantInventoryOverview(ctx, channel);
    }
    /**
     * 更新租户仓（名称/配送方式/服务城市/坐标）。
     * 编码与性质不可改：系统虚拟仓整体禁改；默认物理仓强制 kind=physical；
     * 历史未打标数据仅补归属 channelCode，不改 kind/code（避免库存口径漂移）。
     */
    async updateTenantPhysicalLocation(ctx, input, channel = ctx.channel) {
        var _a, _b, _c, _d, _e, _f;
        const loc = await this.findTenantLocation(ctx, channel.code, input === null || input === void 0 ? void 0 : input.id);
        const cf = (_a = loc.customFields) !== null && _a !== void 0 ? _a : {};
        const code = String((_b = cf.code) !== null && _b !== void 0 ? _b : '');
        if (code === this.virtualCode(channel.code)) {
            throw new core_1.UserInputError('虚拟仓为系统仓，不可编辑');
        }
        const patch = { id: loc.id };
        if (input.name !== undefined) {
            const name = String((_c = input.name) !== null && _c !== void 0 ? _c : '').trim();
            if (!name) {
                throw new core_1.UserInputError('仓库名称不能为空');
            }
            patch.name = name;
        }
        const cfPatch = {};
        if (!String((_d = cf.channelCode) !== null && _d !== void 0 ? _d : '')) {
            cfPatch.channelCode = channel.code;
        }
        if (code === channel.code) {
            cfPatch.kind = 'physical';
        }
        if (input.deliveryMethods !== undefined) {
            cfPatch.deliveryMethods = normalizeDeliveryMethods(input.deliveryMethods);
        }
        if (input.serviceCities !== undefined) {
            cfPatch.serviceCities = normalizeCities(input.serviceCities);
        }
        if (input.lat !== undefined) {
            cfPatch.lat = (_e = input.lat) !== null && _e !== void 0 ? _e : null;
        }
        if (input.lng !== undefined) {
            cfPatch.lng = (_f = input.lng) !== null && _f !== void 0 ? _f : null;
        }
        if (Object.keys(cfPatch).length) {
            patch.customFields = cfPatch;
        }
        await this.stockLocationService.update(ctx, patch);
        return this.getTenantInventoryOverview(ctx, channel);
    }
    /** 删除租户仓；系统仓（默认物理仓 / 虚拟仓）不可删除 */
    async deleteTenantPhysicalLocation(ctx, id, channel = ctx.channel) {
        var _a, _b;
        const loc = await this.findTenantLocation(ctx, channel.code, id);
        const code = String((_b = ((_a = loc.customFields) !== null && _a !== void 0 ? _a : {}).code) !== null && _b !== void 0 ? _b : '');
        if (this.isSystemLocationCode(channel.code, code)) {
            throw new core_1.UserInputError('系统仓（默认物理仓 / 虚拟仓）不可删除');
        }
        await this.assertLocationDeletable(ctx, loc);
        await this.stockLocationService.delete(ctx, { id: loc.id });
        return this.getTenantInventoryOverview(ctx, channel);
    }
    /**
     * 删仓前置安全校验：core 的 delete 未传 transferToLocationId 时会级联删除该仓全部 StockLevel
     * （库存静默蒸发），因此仍有库存 / 被变体绑定 / 有未完成出库预留时一律拒绝。
     */
    async assertLocationDeletable(ctx, loc) {
        const levels = await this.connection
            .getRepository(ctx, core_1.StockLevel)
            .find({ where: { stockLocationId: loc.id } });
        const held = levels.reduce((sum, l) => { var _a, _b; return sum + ((_a = l.stockOnHand) !== null && _a !== void 0 ? _a : 0) + ((_b = l.stockAllocated) !== null && _b !== void 0 ? _b : 0); }, 0);
        if (held > 0) {
            throw new core_1.UserInputError(`仓库「${loc.name}」仍有库存 ${held}，请先调拨或清零后再删除`);
        }
        const binding = await this.connection
            .getRepository(ctx, variant_location_binding_entity_1.VariantLocationBinding)
            .findOne({ where: { locationId: loc.id } });
        if (binding) {
            throw new core_1.UserInputError(`仓库「${loc.name}」仍被商品变体绑定，请先解绑后再删除`);
        }
        const reservation = await this.connection
            .getRepository(ctx, stock_reservation_item_entity_1.StockReservationItemEntity)
            .findOne({ where: { stockLocationId: loc.id, status: 'PENDING' } });
        if (reservation) {
            throw new core_1.UserInputError(`仓库「${loc.name}」仍有未完成的出库预留，暂不可删除`);
        }
    }
    /** 替换式写入变体绑定；校验每个仓为物理仓且归属当前租户 */
    async setVariantBindings(ctx, variantId, bindings) {
        var _a, _b, _c;
        const repo = this.connection.getRepository(ctx, variant_location_binding_entity_1.VariantLocationBinding);
        await repo.delete({ variantId: variantId });
        const saved = [];
        for (const b of bindings) {
            const loc = await this.connection.getEntityOrThrow(ctx, core_1.StockLocation, b.locationId);
            const kind = (_a = loc.customFields) === null || _a === void 0 ? void 0 : _a.kind;
            if (kind !== 'physical') {
                throw new Error(`仓库 ${b.locationId} 非物理仓，无法绑定`);
            }
            const ownerCode = String((_c = (_b = loc.customFields) === null || _b === void 0 ? void 0 : _b.code) !== null && _c !== void 0 ? _c : '');
            if (ownerCode !== ctx.channel.code && !ownerCode.startsWith(`${ctx.channel.code}-`)) {
                throw new Error(`仓库 ${b.locationId} 不属于当前租户`);
            }
            const savedBinding = await repo.save(new variant_location_binding_entity_1.VariantLocationBinding({ variantId, locationId: b.locationId, isDefault: b.isDefault }));
            saved.push(savedBinding);
        }
        return saved;
    }
    /** SALE 后镜像：物理驱动变体的虚拟仓 onHand 同步为 Σ 绑定物理仓 onHand（同事务） */
    async syncVirtualMirror(ctx, sales) {
        var _a, _b;
        if (!(sales === null || sales === void 0 ? void 0 : sales.length)) {
            return;
        }
        const virtual = await this.ensureVirtualLocation(ctx);
        const variantIds = [...new Set(sales.map(s => { var _a, _b; return String((_a = s.productVariantId) !== null && _a !== void 0 ? _a : (_b = s.productVariant) === null || _b === void 0 ? void 0 : _b.id); }))];
        const bindingRepo = this.connection.getRepository(ctx, variant_location_binding_entity_1.VariantLocationBinding);
        for (const variantId of variantIds) {
            const bindings = await bindingRepo.find({ where: { variantId: variantId } });
            if (!bindings.length) {
                continue;
            }
            const boundIds = bindings.map(b => b.locationId);
            const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, variantId);
            const boundTotal = (0, mirror_math_1.sumBoundOnHand)(levels.map(l => ({ locationId: l.stockLocationId, onHand: l.stockOnHand })), boundIds);
            const currentVirtual = (_b = (_a = levels.find(l => String(l.stockLocationId) === String(virtual.id))) === null || _a === void 0 ? void 0 : _a.stockOnHand) !== null && _b !== void 0 ? _b : 0;
            const delta = (0, mirror_math_1.calcMirrorDelta)(currentVirtual, boundTotal);
            if (delta === 0) {
                continue;
            }
            await this.inventoryService.adjustStockPublic(ctx, variantId, virtual.id, delta, `虚拟镜像同步(variant=${variantId})`, { bizType: 'mirror', bizCode: `mirror-${variantId}` });
            core_1.Logger.info(`镜像同步: variant=${variantId} 虚拟仓 ${currentVirtual} -> ${boundTotal}`, loggerCtx);
        }
    }
    /** 注册 SALE 阻塞处理器（镜像必须在 core 扣库同一事务内执行；配送记录同步同事务防漏单） */
    registerMirrorHandler() {
        this.eventBus.registerBlockingEventHandler({
            event: core_1.StockMovementEvent,
            id: 'cjk-plugin.sync-virtual-mirror',
            handler: event => {
                if (event.type === 'SALE') {
                    const sales = event.stockMovements;
                    return this.syncVirtualMirror(event.ctx, sales).then(async () => {
                        await this.syncDeliveryRecords(event.ctx, sales);
                    });
                }
                return undefined;
            },
        });
    }
    /** SALE 后生成顾客配送记录（方案2-B）；pickup 订单标记自提模式 */
    async syncDeliveryRecords(ctx, sales) {
        var _a;
        const records = await this.deliveryRecordService.createFromSales(ctx, sales);
        if (!records.length) {
            return;
        }
        // pickup 订单：按订单级配送方式重设模式
        const orderIds = [...new Set(records.map(r => String(r.orderId)))];
        const orderRepo = this.connection.getRepository(ctx, core_1.Order);
        const orders = await orderRepo.find({ where: { id: (0, typeorm_1.In)(orderIds) } });
        for (const order of orders) {
            const c = (_a = order.customFields) !== null && _a !== void 0 ? _a : {};
            if (c.deliveryType === 'pickup' && c.selectedPickupLocationId) {
                for (const rec of records.filter(r => String(r.orderId) === String(order.id))) {
                    await this.deliveryRecordService.markAsPickup(ctx, rec.id, c.selectedPickupLocationId);
                }
            }
        }
    }
    /** 店铺端：saleableStock（虚拟仓可售）+ 物理驱动时的绑定仓明细（距离就近排序） */
    async getSaleableAndDetail(ctx, variantId, lat, lng, city, deliveryMethod) {
        var _a, _b;
        const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, variantId);
        const physicalStockEnabled = Boolean((_a = ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.physicalStockEnabled);
        const bindings = await this.connection
            .getRepository(ctx, variant_location_binding_entity_1.VariantLocationBinding)
            .find({ where: { variantId: variantId } });
        // 虚拟可售源：汇总该变体在本渠道下所有 kind=virtual 仓的 onHand。
        // 旧实现只取 code=<channel>-virtual 的单一自动仓，会漏掉无 customFields.code 的「默认仓」类
        // 虚拟仓里的真实库存，导致无物理绑定时 saleableStock 恒为 0、线上显示「无货」（回归）。
        // 绑定物理仓的变体仍走下方物理路径不受影响。
        const vc = this.virtualCode(ctx.channel.code);
        const virtualIds = new Set((await this.connection.getRepository(ctx, core_1.StockLocation).find({ loadEagerRelations: false }))
            .filter(l => {
            var _a, _b;
            const cf = (_a = l.customFields) !== null && _a !== void 0 ? _a : {};
            if (cf.kind !== 'virtual')
                return false;
            const code = String((_b = cf.code) !== null && _b !== void 0 ? _b : '');
            return !code || code === vc;
        })
            .map(l => String(l.id)));
        const virtualOnHand = levels
            .filter(l => virtualIds.has(String(l.stockLocationId)))
            .reduce((s, l) => { var _a; return s + ((_a = l.stockOnHand) !== null && _a !== void 0 ? _a : 0); }, 0);
        let stockDetail = [];
        let saleableStock = virtualOnHand;
        if (physicalStockEnabled && bindings.length) {
            const boundIds = bindings.map(b => b.locationId);
            const locs = await this.connection
                .getRepository(ctx, core_1.StockLocation)
                .find({ where: { id: (0, typeorm_1.In)(boundIds) }, loadEagerRelations: false });
            const origin = lat != null && lng != null ? { lat, lng } : null;
            // 配送口径：自提=可自提点、邮寄=可发仓、空=全部（兼容旧数据）
            const requested = deliveryMethod ? [deliveryMethod] : [];
            const eligibleLocs = requested.length ? (0, delivery_methods_1.filterLocationsByDelivery)(locs, requested) : locs;
            // 按城市聚合：city 为空 → 全部 eligible 仓；否则仅服务该城市的 eligible 仓
            const cities = new Map();
            for (const loc of eligibleLocs) {
                cities.set(String(loc.id), (_b = loc.customFields) === null || _b === void 0 ? void 0 : _b.serviceCities);
            }
            const { servedLocations, servedOnHand } = (0, stock_city_filter_1.pinByCity)(levels.map(l => ({ stockLocationId: l.stockLocationId, stockOnHand: l.stockOnHand })), bindings, cities, city);
            const servedLocs = servedLocations.length ? eligibleLocs.filter(l => servedLocations.some(id => String(id) === String(l.id))) : [];
            stockDetail = servedLocs
                .map(loc => {
                var _a, _b, _c, _d, _e, _f;
                const level = levels.find(l => String(l.stockLocationId) === String(loc.id));
                const c = (_a = loc.customFields) !== null && _a !== void 0 ? _a : {};
                const distanceKm = origin
                    ? (0, mirror_math_1.haversineKm)(origin.lat, origin.lng, (_b = c.lat) !== null && _b !== void 0 ? _b : 0, (_c = c.lng) !== null && _c !== void 0 ? _c : 0)
                    : null;
                return {
                    locationId: loc.id,
                    name: loc.name,
                    lat: (_d = c.lat) !== null && _d !== void 0 ? _d : null,
                    lng: (_e = c.lng) !== null && _e !== void 0 ? _e : null,
                    onHand: (_f = level === null || level === void 0 ? void 0 : level.stockOnHand) !== null && _f !== void 0 ? _f : 0,
                    distanceKm,
                };
            })
                .sort((a, b) => {
                if (a.distanceKm == null)
                    return 1;
                if (b.distanceKm == null)
                    return -1;
                return a.distanceKm - b.distanceKm;
            });
            // 提供 city 时主库存取城市仓合计；城市无仓可服务或未提供 city 回退全局虚拟仓
            if (city) {
                saleableStock = servedOnHand > 0 ? servedOnHand : virtualOnHand;
            }
        }
        return { variantId, saleableStock, physicalStockEnabled, stockDetail };
    }
    /**
     * 统一物理仓调库原语（单据/预留单/订单钩子共用）：
     * delta>0 入库、delta<0 出库。负 delta 校验物理仓 onHand 充足，不足抛「物理库存不足」。
     * 复用 inventory-plugin 的 adjustStockPublic：写 StockAdjustment 流水 + 可选 OrderStockLedger 账本。
     */
    async adjustPhysicalStock(ctx, variantId, locationId, delta, reason, meta) {
        if (delta === 0) {
            return;
        }
        if (delta < 0) {
            const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
            if (current.stockOnHand + delta < 0) {
                throw new core_1.UserInputError(`物理库存不足：variant=${variantId} 仓库=${locationId} 需${-delta} 现有${current.stockOnHand}`);
            }
        }
        await this.inventoryService.adjustStockPublic(ctx, variantId, locationId, delta, reason, meta);
    }
    /**
     * 物理仓盘点覆盖语义：将某仓 onHand 置为绝对值 targetOnHand。
     * 返回实际差异 delta（目标-当前），写 stocktake 账本流水（meta.bizCode=单据号）。
     */
    async setPhysicalStock(ctx, variantId, locationId, targetOnHand, reason, meta) {
        const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        const delta = targetOnHand - current.stockOnHand;
        if (delta !== 0) {
            await this.inventoryService.adjustStockPublic(ctx, variantId, locationId, delta, reason, meta);
        }
        return delta;
    }
};
exports.VirtualPhysicalStockService = VirtualPhysicalStockService;
exports.VirtualPhysicalStockService = VirtualPhysicalStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.StockLocationService,
        core_1.StockLevelService,
        inventory_plugin_1.InventoryService,
        core_1.EventBus,
        delivery_record_service_1.DeliveryRecordService])
], VirtualPhysicalStockService);
//# sourceMappingURL=virtual-physical-stock.service.js.map