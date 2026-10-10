import { DeepPartial, VendureEntity } from '@vendure/core';
/** 商品收藏行（同 productId+customerId 唯一） */
export declare class ProductFavorite extends VendureEntity {
    constructor(input?: DeepPartial<ProductFavorite>);
    productId: number;
    customerId: number;
    channelId: number;
    favoritedAt: Date;
}
