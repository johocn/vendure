import { ID, TransactionalConnection } from '@vendure/core';
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
}
