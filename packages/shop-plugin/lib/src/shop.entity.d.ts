import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 商家店铺档案主体（区别于 Channel 租户维度）。
 * 评分/商品数为普通缓存列（service 实时重算后写回），不参与对外 customFields。
 */
export declare class Shop extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Shop>);
    name: string;
    /** 唯一 slug，用于 C 端 URL 与查询。 */
    slug: string;
    logoAssetId: number | null;
    bannerAssetId: number | null;
    description: string | null;
    /** applicant | active | closed */
    status: string;
    /** 店主后台账号主键（Administrator.id）。归属解析：activeUserId→Administrator.user→this.administratorId。 */
    administratorId: number | null;
    channelId: number;
    /** 评分缓存列（service 实时聚合后写回，供列表/店铺页直接读取，避免 N+1）。 */
    shopRating: number | null;
    shopReviewCount: number | null;
    shopProductCount: number | null;
    channels: Channel[];
}
