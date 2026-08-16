import { EntityHydrator, ID, Product, RequestContext, TransactionalConnection } from '@vendure/core';
export interface MarketplaceProductsOptions {
    take?: number;
    skip?: number;
}
export declare class MarketplaceService {
    private connection;
    private entityHydrator;
    constructor(connection: TransactionalConnection, entityHydrator: EntityHydrator);
    /** 校验条形码在平台内唯一（跨所有 Channel）。返回所属 ProductId 与首个 VariantId；空则无冲突。 */
    findBarcodeOwner(barcode: string): Promise<{
        productId: ID;
        variantId: ID;
    } | null>;
    /** 保存前校验：若 barcode 已被其他商品占用则抛错 */
    assertBarcodeUnique(barcode: string, excludeProductId?: ID): Promise<void>;
    getProductOrThrow(ctx: RequestContext, productId: ID): Promise<Product>;
    /** 商家提交商品上架 marketplace（置审批中，不对外展示） */
    submitForMarketplace(ctx: RequestContext, productId: ID): Promise<void>;
    /** 平台运营/超管审批通过：对外展示 */
    approveMarketplaceProduct(ctx: RequestContext, productId: ID): Promise<void>;
    /** 平台运营/超管驳回：不展示，记录原因 */
    rejectMarketplaceProduct(ctx: RequestContext, productId: ID, reason: string): Promise<void>;
    /** 待审批商品列表 */
    getPendingProducts(ctx: RequestContext): Promise<Product[]>;
    /**
     * 聚合 marketplace 对外展示的商品（自营 + 各商家）。
     * 仅返回 marketplaceStatus='approved' 且 listedInMarketplace=true 的商品，
     * 并 hydrate 商家渠道（merchantRef）与商品主图（featuredAsset），供前端按商家分组展示。
     * relation custom field 存储于独立 junction 表，故用 EntityHydrator 加载最稳妥。
     */
    getMarketplaceProducts(ctx: RequestContext, options?: MarketplaceProductsOptions): Promise<Product[]>;
}
