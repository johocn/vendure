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
const loggerCtx = 'VirtualPhysicalStockService';
let VirtualPhysicalStockService = class VirtualPhysicalStockService {
    constructor(connection, stockLocationService, stockLevelService, inventoryService, eventBus) {
        this.connection = connection;
        this.stockLocationService = stockLocationService;
        this.stockLevelService = stockLevelService;
        this.inventoryService = inventoryService;
        this.eventBus = eventBus;
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
    /** 注册 SALE 阻塞处理器（镜像必须在 core 扣库同一事务内执行） */
    registerMirrorHandler() {
        this.eventBus.registerBlockingEventHandler({
            event: core_1.StockMovementEvent,
            id: 'cjk-plugin.sync-virtual-mirror',
            handler: event => {
                if (event.type === 'SALE') {
                    return this.syncVirtualMirror(event.ctx, event.stockMovements);
                }
                return undefined;
            },
        });
    }
    /** 店铺端：saleableStock（虚拟仓可售）+ 物理驱动时的绑定仓明细（距离就近排序） */
    async getSaleableAndDetail(ctx, variantId, lat, lng) {
        var _a, _b, _c;
        const virtual = await this.ensureVirtualLocation(ctx);
        const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, variantId);
        const physicalStockEnabled = Boolean((_a = ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.physicalStockEnabled);
        const bindings = await this.connection
            .getRepository(ctx, variant_location_binding_entity_1.VariantLocationBinding)
            .find({ where: { variantId: variantId } });
        const virtualOnHand = (_c = (_b = levels.find(l => String(l.stockLocationId) === String(virtual.id))) === null || _b === void 0 ? void 0 : _b.stockOnHand) !== null && _c !== void 0 ? _c : 0;
        let stockDetail = [];
        if (physicalStockEnabled && bindings.length) {
            const boundIds = bindings.map(b => b.locationId);
            const locs = await this.connection
                .getRepository(ctx, core_1.StockLocation)
                .find({ where: { id: (0, typeorm_1.In)(boundIds) }, loadEagerRelations: false });
            const origin = lat != null && lng != null ? { lat, lng } : null;
            stockDetail = locs
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
        }
        return {
            variantId,
            saleableStock: virtualOnHand,
            physicalStockEnabled,
            stockDetail,
        };
    }
};
exports.VirtualPhysicalStockService = VirtualPhysicalStockService;
exports.VirtualPhysicalStockService = VirtualPhysicalStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.StockLocationService,
        core_1.StockLevelService,
        inventory_plugin_1.InventoryService,
        core_1.EventBus])
], VirtualPhysicalStockService);
//# sourceMappingURL=virtual-physical-stock.service.js.map