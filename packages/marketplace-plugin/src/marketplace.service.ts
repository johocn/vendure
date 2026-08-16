import { Injectable } from '@nestjs/common';
import {
    ID,
    Product,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

@Injectable()
export class MarketplaceService {
    constructor(private connection: TransactionalConnection) {}

    /** 校验条形码在平台内唯一（跨所有 Channel）。返回所属 ProductId 与首个 VariantId；空则无冲突。 */
    async findBarcodeOwner(barcode: string): Promise<{ productId: ID; variantId: ID } | null> {
        if (!barcode) return null;
        const repo = this.connection.rawConnection.getRepository(Product);
        const product = await repo
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.customFields', 'cf')
            .leftJoinAndSelect('product.variants', 'variant')
            .where('cf.barcode = :barcode', { barcode })
            .getOne();
        if (!product || !product.variants || product.variants.length === 0) {
            return null;
        }
        return { productId: product.id, variantId: product.variants[0].id };
    }

    /** 保存前校验：若 barcode 已被其他商品占用则抛错 */
    async assertBarcodeUnique(barcode: string, excludeProductId?: ID): Promise<void> {
        const owner = await this.findBarcodeOwner(barcode);
        if (owner && (!excludeProductId || owner.productId !== excludeProductId)) {
            throw new UserInputError(`条形码 ${barcode} 已被占用`);
        }
    }
}