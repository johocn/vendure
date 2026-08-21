import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 商家配送范围（一店一档）。关联 shop-plugin 的 Shop（shopId）。
 * rangeType: all 不限 / circle 圆心半径(km) / district 省市区白名单。
 * districtCodes 存 JSON 文本数组，跨库安全，服务内 JSON.parse。
 */
export declare class DeliveryRange extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<DeliveryRange>);
    shopId: number;
    enabled: boolean;
    rangeType: string;
    centerLng: number | null;
    centerLat: number | null;
    radiusKm: number | null;
    districtCodes: string | null;
    /** 基础运费（分）；freeThreshold 满额包邮阈值（分），null=该店不支持包邮。 */
    baseFee: number;
    freeThreshold: number | null;
    channelId: number;
    channels: Channel[];
}
