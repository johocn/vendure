import { Administrator, AdministratorService, ID, OrderService, PaginatedList, Product, ProductService, RequestContext, RoleService, TransactionalConnection } from '@vendure/core';
import { Shop } from './shop.entity';
import { AssignProductsInput, CreateOwnerInput, CreateShopInput, FulfillMyShopOrderResult, MerchantFulfillment, MerchantOrder, MerchantReview, ShopListOptions, ShopRating, ShopStatus, UpdateMyShopInput, UpdateMyShopProductInput, UpdateShopInput } from './types';
export declare class ShopService {
    private connection;
    private productService;
    private administratorService;
    private roleService;
    private orderService;
    constructor(connection: TransactionalConnection, productService: ProductService, administratorService: AdministratorService, roleService: RoleService, orderService: OrderService);
    createShop(ctx: RequestContext, input: CreateShopInput): Promise<Shop>;
    updateShop(ctx: RequestContext, id: ID, input: UpdateShopInput): Promise<Shop>;
    setShopStatus(ctx: RequestContext, id: ID, status: ShopStatus): Promise<Shop>;
    assignProductsToShop(ctx: RequestContext, input: AssignProductsInput): Promise<boolean>;
    unassignProductsFromShop(ctx: RequestContext, input: AssignProductsInput): Promise<boolean>;
    /** 管理端列表（全部状态）。 */
    shops(ctx: RequestContext, options?: ShopListOptions): Promise<Shop[]>;
    getShop(ctx: RequestContext, id: ID): Promise<Shop>;
    /** C 端列表：仅 active 店铺。 */
    getActiveShops(ctx: RequestContext, options?: ShopListOptions): Promise<Shop[]>;
    /** C 端店铺主页：仅 active 对外；slug 不存在或非 active 返回 undefined（Query 返回 nullable）。 */
    getShopBySlug(ctx: RequestContext, slug: string): Promise<Shop | undefined>;
    /** 店铺商品分页列表：按 Product.customFields.shopId 过滤（marketplace 同款写法）。 */
    getShopProducts(ctx: RequestContext, shopId: ID, options?: ShopListOptions): Promise<PaginatedList<Product>>;
    /** 店铺评分（实时口径）：聚合归属商品的 reviewRating/reviewCount。始终正确。 */
    getShopRating(ctx: RequestContext, shopId: ID): Promise<ShopRating>;
    /** 重算店铺评分并写回 Shop 缓存列（列表/店铺页读取，避免 N+1）。 */
    recomputeShopRating(ctx: RequestContext, shopId: ID): Promise<Shop>;
    /** 读店铺缓存评分（供 ResolveField）；无缓存时回退实时计算。 */
    getShopRatingCachedOrCompute(ctx: RequestContext, shop: Shop): Promise<ShopRating>;
    /**
     * 归属解析：activeUserId → Administrator.user → Shop.administratorId（优先）。
     * 渠道回退：管理员无绑定店铺（平台/superadmin 按城市选店场景）时，按当前经营渠道
     * ctx.channelId 解析该渠道 active 店铺，使 web-admin 的「本店商品单/统计」可用。
     * 多店并存渠道取首个，语义为「本渠道本店」（当前为单店/渠道模型）。
     */
    resolveMyShopFromActiveUser(ctx: RequestContext): Promise<Shop | undefined>;
    /** 店主后台入口守卫：无归属店铺或店铺非 active → Forbidden（关闭店铺即冻结）。 */
    requireMyShop(ctx: RequestContext): Promise<Shop>;
    /** 平台开通店主账号：幂等建 Role + Administrator + 写 Shop.administratorId。 */
    provisionShopOwner(ctx: RequestContext, shopId: ID, input: CreateOwnerInput): Promise<Administrator>;
    private ensureShopOwnerRole;
    updateMyShop(ctx: RequestContext, input: UpdateMyShopInput): Promise<Shop>;
    getMyShopProducts(ctx: RequestContext, options?: ShopListOptions): Promise<PaginatedList<Product>>;
    addProductToMyShop(ctx: RequestContext, productId: ID): Promise<boolean>;
    removeProductFromMyShop(ctx: RequestContext, productId: ID): Promise<boolean>;
    updateMyShopProduct(ctx: RequestContext, productId: ID, input: UpdateMyShopProductInput): Promise<Product>;
    /**
     * 上下架：切换本人店铺商品的 Product.enabled 并同步其全部变体 ProductVariant.enabled。
     * 归属：getMyShopProductOrThrow 校验商品属于本人店铺。
     */
    setMyShopProductEnabled(ctx: RequestContext, productId: ID, enabled: boolean): Promise<boolean>;
    getMyShopOrders(ctx: RequestContext): Promise<MerchantOrder[]>;
    getMyShopOrder(ctx: RequestContext, orderId: ID): Promise<MerchantOrder | undefined>;
    /**
     * 店主发货：对该订单中归属本店、且尚未履约的行创建 manual Fulfillment 并流转至 Shipped。
     * 已履约完的行跳过；全部已履约则直接返回摘要不发重复货。
     */
    fulfillMyShopOrder(ctx: RequestContext, orderId: ID, method?: string, trackingCode?: string, lines?: Array<{
        orderLineId: ID;
        quantity: number;
    }>): Promise<FulfillMyShopOrderResult>;
    /**
     * 筛选本次要发货的行/数量。传 lines 则只发命中本店、且 quantity>0 的行（量超 remaining 截断）；
     * 否则把本店所有 remaining>0 的行按剩余量一次发出。
     */
    private pickToFulfill;
    /** 店主查看该订单本店行的发货单列表（state!=Cancelled）。 */
    getMyShopOrderFulfillments(ctx: RequestContext, orderId: ID): Promise<MerchantFulfillment[]>;
    /**
     * 解析指定订单中归属本店的行及其履约量。
     * 返回：myLines（line + fulfilled + remaining）、总产量、nameByLine（orderLineId→商品/变体名）。
     */
    private resolveMyShopOrder;
    getMyShopReviews(ctx: RequestContext): Promise<MerchantReview[]>;
    approveMerchantReview(ctx: RequestContext, id: ID): Promise<boolean>;
    rejectMerchantReview(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 重算单个商品评分聚合（approved 主评加权，与 review-plugin 同口径）并写回 Product.customFields + 店铺评分缓存。 */
    recomputeMerchantProductRating(ctx: RequestContext, productId: number): Promise<void>;
    private getMyShopProductIds;
    private getMyShopProductOrThrow;
    private loadProductNames;
    private loadCustomerName;
    private assertMyReview;
    /** 聚合我店商品行 → MerchantOrder 投影（items 仅含我店行，不泄露他人店铺行）。e2e 规模用内存聚合。 */
    private aggregateMerchantOrders;
    private pickName;
    private assertSlugUnique;
    private getEntityOrThrow;
}
