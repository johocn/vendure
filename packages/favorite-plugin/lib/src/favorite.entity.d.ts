import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 收藏/关注记录。
 * - 收藏商品：productId 非空；关注店铺：shopId 非空（二者其一）。
 * - 复合唯一约束使同一顾客对同一商品/店铺天然幂等（toggle 语义）。
 * - createdAt/updatedAt 由 VendureEntity 基类提供。
 */
export declare class Favorite extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Favorite>);
    customerId: number;
    productId: number | null;
    shopId: number | null;
    channelId: number;
    channels: Channel[];
}
