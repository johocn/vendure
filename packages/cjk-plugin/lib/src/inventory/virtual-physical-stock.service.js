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
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const typeorm_1 = require("typeorm");
const variant_location_binding_entity_1 = require("./variant-location-binding.entity");
const mirror_math_1 = require("./mirror-math");
const stock_city_filter_1 = require("./stock-city-filter");
const delivery_methods_1 = require("./delivery-methods");
const delivery_record_service_1 = require("../delivery/delivery-record.service");
const loggerCtx = 'VirtualPhysicalStockService';
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
    async ensureVirtualLocation(ctx) {
        var _a;
        const code = this.virtualCode(ctx.channel.code);
        const repo = this.connection.getRepository(ctx, core_1.StockLocation);
        const existing = await repo
            .createQueryBuilder('loc')
            .where('loc.customFields.code = :code', { code })
            .getOne();
        if (existing) {
            return existing;
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${ctx.channel.code} 虚拟仓`,
            description: '网络销售可售源（系统自动创建）',
        });
        loc.customFields = Object.assign(Object.assign({}, ((_a = loc.customFields) !== null && _a !== void 0 ? _a : {})), { kind: 'virtual', code });
        await repo.save(loc);
        core_1.Logger.info(`虚拟仓已创建: ${code}`, loggerCtx);
        return loc;
    }
    async ensureDefaultPhysicalLocation(ctx) {
        var _a;
        const code = ctx.channel.code;
        const repo = this.connection.getRepository(ctx, core_1.StockLocation);
        const existing = await repo
            .createQueryBuilder('loc')
            .where('loc.customFields.code = :code', { code })
            .getOne();
        if (existing) {
            return existing;
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${ctx.channel.code} 默认仓`,
            description: '物理库存默认仓（开启物理库存时自动创建）',
        });
        loc.customFields = Object.assign(Object.assign({}, ((_a = loc.customFields) !== null && _a !== void 0 ? _a : {})), { kind: 'physical', code });
        await repo.save(loc);
        core_1.Logger.info(`默认物理仓已创建: ${code}`, loggerCtx);
        return loc;
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