import { DeepPartial, VendureEntity } from '@vendure/core';
/** 积分商品：引用 core 商品/变体 + 兑换配置（积分价按变体生效，同秒杀价口径） */
export declare class PointsProduct extends VendureEntity {
    constructor(input?: DeepPartial<PointsProduct>);
    productId: number;
    variantId: number;
    pointsPrice: number;
    cashPrice: number;
    /** physical=实物(需地址/发货) virtual=虚拟(直兑到账) */
    deliveryType: string;
    stock: number;
    perUserLimit: number;
    redeemedCount: number;
    validFrom: Date | null;
    validTo: Date | null;
    status: string;
    sortOrder: number;
    channelId: number;
}
