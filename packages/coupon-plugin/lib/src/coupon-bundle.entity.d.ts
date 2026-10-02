import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { LocalizedText } from './localize';
/**
 * 出售型券包：购买一次按 CouponBundleItem 循环生成包内全部券。
 * 名称/说明为 LocalizedText（存 text 列，transformer 序列化）。
 */
export declare class CouponBundle extends VendureEntity {
    constructor(input?: DeepPartial<CouponBundle>);
    name: LocalizedText;
    description?: LocalizedText;
    /** 整包售价（分） */
    salePrice: number;
    enabled: boolean;
    /** 发行归属店铺（店铺隔离，null = 平台级） */
    shopId: number | null;
    channel: Channel;
    channelId: number;
}
/** 券包内单项：某券模板在包内的张数 */
export declare class CouponBundleItem extends VendureEntity {
    constructor(input?: DeepPartial<CouponBundleItem>);
    bundleId: number;
    templateId: number;
    quantity: number;
}
