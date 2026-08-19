"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatrixStockLocationStrategy = void 0;
const core_1 = require("@vendure/core");
const nearest_stock_location_strategy_1 = require("./nearest-stock-location-strategy");
const matrix_allocators_1 = require("./matrix-allocators");
const STORE_SUFFIX = '店';
const MARKETPLACE_SUFFIX = '云仓';
/**
 * 库存策略矩阵：单一全局 StockLocationStrategy。
 * 继承 NearestStockLocationStrategy（含 MultiChannel 库存核算 + 服务范围门禁 + 自提锚点），
 * 在下单分配时按 渠道 × 配送方式 × 会员等级 判定规则，产出排序后的候选仓后交给父类扣减，
 * 天然产出多仓 LocationWithQuantity[]（余量拆单）。
 */
class MatrixStockLocationStrategy extends nearest_stock_location_strategy_1.NearestStockLocationStrategy {
    async init(injector) {
        await super.init(injector);
        this.entityHydrator = injector.get(core_1.EntityHydrator);
        this.stockLevelService = injector.get(core_1.StockLevelService);
    }
    async forAllocation(ctx, stockLocations, orderLine, quantity) {
        var _a, _b, _c, _d;
        const order = await this.loadOrder(ctx, orderLine);
        const channelCf = ((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {});
        // 渠道隔离：商城(店)/云仓(云仓) 按后缀过滤，无命中则全量（沿用 Marketplace 惯例）
        const suffix = ((_c = order === null || order === void 0 ? void 0 : order.customFields) === null || _c === void 0 ? void 0 : _c.saleSource) === 'marketplace' ? MARKETPLACE_SUFFIX : STORE_SUFFIX;
        const pool = stockLocations.filter(loc => loc.name.endsWith(suffix));
        const candidates = pool.length > 0 ? pool : stockLocations;
        // 服务范围门禁 + 锚点由父类 orderByProximity 处理；此处仅按矩阵重排
        const anchor = await this.readAnchor(ctx, orderLine);
        const stockOnHandMap = new Map();
        for (const loc of candidates) {
            try {
                const level = await this.stockLevelService.getStockLevel(ctx, orderLine.productVariantId, loc.id);
                stockOnHandMap.set(String(loc.id), (_d = level.stockOnHand) !== null && _d !== void 0 ? _d : 0);
            }
            catch (_e) {
                stockOnHandMap.set(String(loc.id), 0);
            }
        }
        const decision = await this.decideRule(ctx, order, candidates, stockOnHandMap);
        const priorityConfig = (0, matrix_allocators_1.parsePriorityConfig)(channelCf.stockLocationPriority);
        let ranked;
        switch (decision.rule) {
            case 'member': {
                const rule = (0, matrix_allocators_1.parseMemberRules)(channelCf.memberStockStrategy)
                    .find(r => r.level === decision.level);
                ranked = (0, matrix_allocators_1.rankByMemberRule)(candidates, rule, priorityConfig, stockOnHandMap, anchor);
                break;
            }
            case 'priority':
                ranked = (0, matrix_allocators_1.rankByPriority)(candidates, priorityConfig);
                break;
            case 'stock-first':
                ranked = (0, matrix_allocators_1.rankByStockFirst)(candidates, stockOnHandMap);
                break;
            default:
                ranked = (0, matrix_allocators_1.rankByNearest)(candidates, anchor);
        }
        core_1.Logger.info(`矩阵判定 orderLine#${orderLine.id} rule=${decision.rule}${decision.level ? ':' + decision.level : ''} ` +
            `qty=${quantity} locs=${ranked.length}`, matrix_allocators_1.loggerCtx);
        const result = await super.forAllocation(ctx, ranked, orderLine, quantity);
        await this.persistSplitDetail(ctx, orderLine, result);
        return result;
    }
    /** 按矩阵优先级判定规则：member > shippingStrategy > 默认就近 */
    async decideRule(ctx, order, candidates, stockOnHandMap) {
        var _a, _b;
        const channelCf = ((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {});
        const rules = (0, matrix_allocators_1.parseMemberRules)(channelCf.memberStockStrategy);
        if (rules.length > 0) {
            const level = await this.resolveMemberLevel(ctx, order);
            const rule = rules.find(r => r.level === level);
            if (rule) {
                const hasStock = rule.locationIds.some(id => candidates.some(c => { var _a; return String(c.id) === String(id) && ((_a = stockOnHandMap.get(String(id))) !== null && _a !== void 0 ? _a : 0) > 0; }));
                if (hasStock) {
                    return { rule: 'member', level };
                }
            }
        }
        switch (channelCf.shippingStrategy) {
            case 'priority':
                return { rule: 'priority' };
            case 'stock-first':
                return { rule: 'stock-first' };
            case 'nearest':
            default:
                return { rule: 'nearest' };
        }
    }
    /** 读取订单 Customer 的会员等级（LV1..LV5），未登录/无等级按 LV1 */
    async resolveMemberLevel(ctx, order) {
        var _a, _b, _c;
        if (!order) {
            return 'LV1';
        }
        try {
            await this.entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
            const lv = (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.memberLevel;
            return lv != null && Number(lv) >= 1 && Number(lv) <= 5 ? `LV${Number(lv)}` : 'LV1';
        }
        catch (e) {
            core_1.Logger.warn(`读取会员等级失败，按 LV1 处理: ${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, matrix_allocators_1.loggerCtx);
            return 'LV1';
        }
    }
    async loadOrder(ctx, orderLine) {
        var _a;
        if (orderLine.order) {
            return orderLine.order;
        }
        const orderId = orderLine.orderId;
        if (orderId == null) {
            return undefined;
        }
        try {
            return (_a = (await this.connection.getRepository(ctx, core_1.Order).findOne({ where: { id: orderId } }))) !== null && _a !== void 0 ? _a : undefined;
        }
        catch (_b) {
            return undefined;
        }
    }
    async readAnchor(ctx, orderLine) {
        var _a, _b;
        const order = (_a = orderLine.order) !== null && _a !== void 0 ? _a : await this.loadOrder(ctx, orderLine);
        const cf = ((_b = order === null || order === void 0 ? void 0 : order.customFields) !== null && _b !== void 0 ? _b : {});
        let lat = cf.lat != null ? Number(cf.lat) : NaN;
        let lng = cf.lng != null ? Number(cf.lng) : NaN;
        if (cf.deliveryType === 'pickup' && cf.pickupLat != null && cf.pickupLng != null) {
            lat = Number(cf.pickupLat);
            lng = Number(cf.pickupLng);
        }
        return { lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null };
    }
    /** 将拆分明细写入 OrderLine.stockLocationsJson（Task 2 提供字段），同时保留主仓 stockLocationId */
    async persistSplitDetail(ctx, orderLine, result) {
        var _a, _b;
        try {
            const positive = result.filter(r => r.quantity > 0);
            if (positive.length === 0) {
                return;
            }
            const main = positive[0];
            const details = positive.map(r => ({
                locationId: String(r.location.id),
                quantity: r.quantity,
            }));
            const cf = Object.assign(Object.assign({}, ((_a = orderLine.customFields) !== null && _a !== void 0 ? _a : {})), { stockLocationId: String(main.location.id), stockLocationsJson: JSON.stringify(details) });
            const repo = this.connection.getRepository(ctx, core_1.OrderLine);
            const fresh = await repo.findOne({ where: { id: orderLine.id } });
            if (!fresh) {
                return;
            }
            fresh.customFields = cf;
            await repo.save((await import('@vendure/common/lib/pick')).pick(fresh, ['id', 'customFields']), { reload: false });
            orderLine.customFields = cf;
            core_1.Logger.info(`orderLine#${orderLine.id} 拆分明细 -> ${details.map(d => `${d.locationId}x${d.quantity}`).join(',')}`, matrix_allocators_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`记录拆分明细失败（不影响下单）: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, matrix_allocators_1.loggerCtx);
        }
    }
}
exports.MatrixStockLocationStrategy = MatrixStockLocationStrategy;
//# sourceMappingURL=matrix-stock-location-strategy.js.map