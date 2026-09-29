import { ID, ProductService, RequestContext, TransactionalConnection } from '@vendure/core';
/**
 * 计入销量的订单状态白名单 = 「已支付及之后」。
 * AddingItems / ArrangingPayment / PaymentAuthorized / Modifying / ArrangingAdditionalPayment /
 * Draft / Cancelled 天然排除（草稿单处于 Draft 状态，无需额外过滤）。
 */
export declare const COUNTED_ORDER_STATES: string[];
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
export declare class ProductStatsService {
    private connection;
    private productService;
    constructor(connection: TransactionalConnection, productService: ProductService);
    /** 全量重算（分页遍历所有**未软删除**的商品）。返回本次实际被更新的商品数。 */
    recomputeAll(ctx: RequestContext): Promise<number>;
    /**
     * 按商品重算并写回展示值。返回本次实际被更新的商品数。
     * 与库中现值完全一致的商品会被跳过（不写库、不发事件）。
     */
    recomputeForProducts(ctx: RequestContext, productIds: ID[]): Promise<number>;
    /**
     * 取**未软删除**的商品。
     *
     * 注意：`Product.deletedAt` 是普通 `@Column`（不是 `@DeleteDateColumn`，Vendure 用 `SoftDeletable`
     * 自行管理软删除），因此 TypeORM 的 `find()` **不会**自动过滤软删除行；而 `ProductService.update`
     * 内部会过滤。把软删除商品交给 `update` 就会抛 `EntityNotFoundError`（线上已被这个坑打到：
     * `product` 表 83 行里仅 18 行存活，全量重算时第一个软删除行 id=1 直接报 `No Product with the id "1"`）。
     * 这里显式排除 `deletedAt IS NOT NULL`。
     */
    private findAliveProducts;
    /**
     * 真实销量：Σ orderLine.quantity，仅计已支付及之后状态的订单；**全渠道合计**
     * （Product 是全局实体，销量不按渠道拆分，见 spec §9 取舍 1）。
     */
    private aggregateSales;
    /**
     * 最低变体价（不含税、单位分）：`product_variant_price` 表的**全渠道最低价**。
     * 取全渠道而非 ctx.channelId，是为了让重算结果与执行上下文无关（三条触发路径的 ctx 渠道可能不同）。
     */
    private aggregateMinPrices;
}
