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
exports.ProductStatsService = exports.COUNTED_ORDER_STATES = void 0;
// d:\zhao\vendure\packages\operations-plugin\src\product-stats.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
/**
 * 计入销量的订单状态白名单 = 「已支付及之后」。
 * AddingItems / ArrangingPayment / PaymentAuthorized / Modifying / ArrangingAdditionalPayment /
 * Draft / Cancelled 天然排除（草稿单处于 Draft 状态，无需额外过滤）。
 */
exports.COUNTED_ORDER_STATES = [
    'PaymentSettled',
    'PartiallyShipped',
    'Shipped',
    'PartiallyDelivered',
    'Delivered',
];
/** 全量重算的分页大小 */
const PRODUCT_PAGE_SIZE = 200;
/**
 * @description
 * 商品展示值（销量 / 可得积分）重算服务。
 *
 * 写回规则：
 * - salesCount     = realSalesCount + bonusSales
 * - pointsReward   = pointsRewardOverride ?? floor(最低变体不含税价)
 *
 * 幂等：结果只由「订单聚合 + 变体价格 + 后台基数/覆盖」决定，与执行上下文（渠道、时间）无关；
 * 写前比对，值未变化则不调用 ProductService.update —— 这同时切断了 ProductEvent 的自激循环。
 */
let ProductStatsService = class ProductStatsService {
    constructor(connection, productService) {
        this.connection = connection;
        this.productService = productService;
    }
    /** 全量重算（分页遍历所有商品）。返回本次实际被更新的商品数。 */
    async recomputeAll(ctx) {
        let skip = 0;
        let updated = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const page = await this.connection.getRepository(ctx, core_1.Product).find({
                order: { id: 'ASC' },
                skip,
                take: PRODUCT_PAGE_SIZE,
            });
            if (page.length === 0) {
                break;
            }
            updated += await this.recomputeForProducts(ctx, page.map(p => p.id));
            if (page.length < PRODUCT_PAGE_SIZE) {
                break;
            }
            skip += PRODUCT_PAGE_SIZE;
        }
        return updated;
    }
    /**
     * 按商品重算并写回展示值。返回本次实际被更新的商品数。
     * 与库中现值完全一致的商品会被跳过（不写库、不发事件）。
     */
    async recomputeForProducts(ctx, productIds) {
        var _a, _b, _c, _d, _e, _f, _g;
        const ids = [...new Set(productIds.map(id => Number(id)))].filter(id => Number.isFinite(id));
        if (ids.length === 0) {
            return 0;
        }
        const [salesMap, priceMap, products] = await Promise.all([
            this.aggregateSales(ctx, ids),
            this.aggregateMinPrices(ctx, ids),
            this.connection.getRepository(ctx, core_1.Product).find({ where: ids.map(id => ({ id })) }),
        ]);
        let updated = 0;
        for (const product of products) {
            const cf = (_a = product.customFields) !== null && _a !== void 0 ? _a : {};
            const realSalesCount = (_b = salesMap.get(Number(product.id))) !== null && _b !== void 0 ? _b : 0;
            const bonusSales = Number((_c = cf.bonusSales) !== null && _c !== void 0 ? _c : 0);
            const salesCount = realSalesCount + bonusSales;
            const override = cf.pointsRewardOverride;
            const pointsReward = override != null ? Number(override) : ((_d = priceMap.get(Number(product.id))) !== null && _d !== void 0 ? _d : 0);
            const unchanged = Number((_e = cf.realSalesCount) !== null && _e !== void 0 ? _e : 0) === realSalesCount &&
                Number((_f = cf.salesCount) !== null && _f !== void 0 ? _f : 0) === salesCount &&
                Number((_g = cf.pointsReward) !== null && _g !== void 0 ? _g : 0) === pointsReward;
            if (unchanged) {
                continue;
            }
            await this.productService.update(ctx, {
                id: product.id,
                customFields: { realSalesCount, salesCount, pointsReward },
            });
            updated++;
        }
        return updated;
    }
    /**
     * 真实销量：Σ orderLine.quantity，仅计已支付及之后状态的订单；**全渠道合计**
     * （Product 是全局实体，销量不按渠道拆分，见 spec §9 取舍 1）。
     */
    async aggregateSales(ctx, productIds) {
        const rows = await this.connection
            .getRepository(ctx, core_1.OrderLine)
            .createQueryBuilder('line')
            .innerJoin('line.order', 'o')
            .innerJoin('line.productVariant', 'v')
            .select('v.productId', 'productId')
            .addSelect('SUM(line.quantity)', 'qty')
            .where('o.state IN (:...states)', { states: exports.COUNTED_ORDER_STATES })
            .andWhere('v.productId IN (:...productIds)', { productIds })
            .groupBy('v.productId')
            .getRawMany();
        const map = new Map();
        for (const row of rows) {
            map.set(Number(row.productId), Number(row.qty));
        }
        return map;
    }
    /**
     * 最低变体价（不含税、单位分）：`product_variant_price` 表的**全渠道最低价**。
     * 取全渠道而非 ctx.channelId，是为了让重算结果与执行上下文无关（三条触发路径的 ctx 渠道可能不同）。
     */
    async aggregateMinPrices(ctx, productIds) {
        const rows = await this.connection
            .getRepository(ctx, core_1.ProductVariantPrice)
            .createQueryBuilder('pvp')
            .innerJoin('pvp.variant', 'v')
            .select('v.productId', 'productId')
            .addSelect('MIN(pvp.price)', 'minPrice')
            .where('v.productId IN (:...productIds)', { productIds })
            .groupBy('v.productId')
            .getRawMany();
        const map = new Map();
        for (const row of rows) {
            map.set(Number(row.productId), Math.floor(Number(row.minPrice)));
        }
        return map;
    }
};
exports.ProductStatsService = ProductStatsService;
exports.ProductStatsService = ProductStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ProductService])
], ProductStatsService);
