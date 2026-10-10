import { ID, PaginatedList, ProductPriceApplicator, RequestContext, TransactionalConnection } from '@vendure/core';
import { PointsOrder } from './points-order.entity';
import { PointsProduct } from './points-product.entity';
import { CreatePointsOrderInput, CreatePointsProductInput, FavoriteProductView, PointsOrderListOptions, PointsPayParams, PointsProductListOptions, PointsProductView, ToggleFavoriteResult, UpdatePointsProductInput } from './types';
export declare class PointsMallService {
    private connection;
    private productPriceApplicator;
    private memberLevel;
    private gateway;
    constructor(connection: TransactionalConnection, productPriceApplicator: ProductPriceApplicator);
    setMemberLevelService(svc: any): void;
    setWechatpayGateway(g: any): void;
    private requireCustomer;
    private getVariantWithProduct;
    /** 运行时填充变体价格（priceWithTax 为 @Calculated getter，需 listPrice/taxRateApplied 就位） */
    private applyVariantPrices;
    /** 批量取变体（含 product/featuredAsset/translations），返回 variantId → 变体 Map */
    private getVariantsWithProduct;
    /** 按语言取翻译，取不到退回第一条 */
    private pickTranslation;
    /** 收藏切换：存在即删（favorited=false），否则插入（favorited=true）。resolver 端 @Transaction() 包裹。 */
    toggleProductFavorite(ctx: RequestContext, productId: ID): Promise<ToggleFavoriteResult>;
    /** 收藏元信息：总数 + 我是否已收藏（游客 myFavorited=false 不抛错）。 */
    favoriteMeta(ctx: RequestContext, productId: ID): Promise<{
        favoriteCount: number;
        myFavorited: boolean;
    }>;
    /** 我的收藏（渠道隔离，id 倒序），带商品视图与最低积分价；商品已删则给占位视图。 */
    myFavorites(ctx: RequestContext, options?: PointsProductListOptions): Promise<{
        items: FavoriteProductView[];
        totalItems: number;
    }>;
    /** 收藏视图批量取数：productId → 该商品下第一个变体（含 product 关联） */
    private getFirstVariantsByProductIds;
    /** 在售积分商品池：productId → 最低 pointsPrice */
    private activePointsPool;
    private assertVariantBelongsToProduct;
    createPointsProduct(ctx: RequestContext, input: CreatePointsProductInput): Promise<PointsProduct>;
    updatePointsProduct(ctx: RequestContext, input: UpdatePointsProductInput): Promise<PointsProduct>;
    deletePointsProduct(ctx: RequestContext, id: ID): Promise<boolean>;
    adminPointsProducts(ctx: RequestContext, options?: PointsProductListOptions): Promise<PaginatedList<PointsProduct>>;
    /** 商城列表：enabled + 在有效期内，排序同 admin。 */
    shopPointsProducts(ctx: RequestContext, options?: PointsProductListOptions): Promise<{
        items: PointsProductView[];
        totalItems: number;
    }>;
    /** 商城单条（enabled）。 */
    shopPointsProduct(ctx: RequestContext, id: ID): Promise<PointsProductView | undefined>;
    private toView;
    private loadPointsProductForOrder;
    private assertBuyable;
    /** 积分兑换下单（resolver 端 @Transaction() 包裹）：扣分 → 原子扣库存 → 建单（code 回写）→ 混合价建支付单。 */
    createPointsOrderExchange(ctx: RequestContext, input: CreatePointsOrderInput): Promise<PointsOrder>;
    /** 混合价现金支付：校验本人订单 + pending_payment，走微信网关裸支付参数。 */
    createPointsOrderPayment(ctx: RequestContext, pointsOrderId: ID, tradeType?: string, openid?: string): Promise<PointsPayParams>;
    /** 支付回调结算：按 outTradeNo（PO-<id>）幂等置为 paid → pending_ship/completed。 */
    settlePointsOrderByOutTradeNo(ctx: RequestContext, outTradeNo: string): Promise<void>;
    /** 未支付取消：退积分 + 回补库存 + 支付单置 cancelled。 */
    cancelPointsOrder(ctx: RequestContext, id: ID): Promise<PointsOrder>;
    myPointsOrders(ctx: RequestContext, options?: PointsOrderListOptions): Promise<PaginatedList<PointsOrder>>;
    myPointsOrder(ctx: RequestContext, id: ID): Promise<PointsOrder | undefined>;
    adminPointsOrders(ctx: RequestContext, options?: PointsOrderListOptions): Promise<PaginatedList<PointsOrder>>;
    markPointsOrderPaid(ctx: RequestContext, id: ID): Promise<PointsOrder>;
    markPointsOrderShipped(ctx: RequestContext, id: ID, trackingNo?: string): Promise<PointsOrder>;
    markPointsOrderCompleted(ctx: RequestContext, id: ID): Promise<PointsOrder>;
    private applyTransition;
}
