import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 顾客收货地址（中国化字段：省市区 + 详细地址 + 经纬度）。
 * 按 customerId 强隔离；isDefault 同顾客唯一。
 */
export declare class DeliveryAddress extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<DeliveryAddress>);
    customerId: number;
    fullName: string;
    phone: string;
    province: string | null;
    city: string | null;
    district: string | null;
    provinceCode: string | null;
    cityCode: string | null;
    districtCode: string | null;
    detail: string | null;
    lng: number | null;
    lat: number | null;
    isDefault: boolean;
    channelId: number;
    channels: Channel[];
}
