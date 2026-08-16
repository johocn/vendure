import { ID, Product, RequestContext, TransactionalConnection } from '@vendure/core';
export declare class MarketplaceService {
    private connection;
    constructor(connection: TransactionalConnection);
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
}
