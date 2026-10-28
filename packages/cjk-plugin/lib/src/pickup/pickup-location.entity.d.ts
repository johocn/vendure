import { ChannelAware, Channel, DeepPartial, HasCustomFields, ID, VendureEntity } from '@vendure/core';
declare class CustomPickupLocationFields {
}
export declare class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PickupLocation>);
    name: string;
    type: 'store' | 'point' | 'employee';
    /** own=门店自提（自带库存，取件即扣）；remote=远程自提（需仓→自提点配送） */
    stockType: string;
    address: string;
    contactPerson: string;
    phoneNumber: string;
    businessHours: string;
    coordinates: {
        lat: number;
        lng: number;
    } | null;
    partner: string;
    photos: string[] | null;
    remark: string | null;
    sortOrder: number;
    enabled: boolean;
    province: string | null;
    city: string | null;
    district: string | null;
    street: string | null;
    isPublic: boolean;
    ownerChannelId: ID | null;
    /**
     * 关联门店 ID（merchant-plugin 的 merchant_store）。
     * 不建外键、不引入 MerchantStore 实体，避免两个插件互相依赖；存在性由服务层校验。
     * 历史数据由 create-merchant-tables 迁移按 type=store 回填。
     */
    merchantStoreId: ID | null;
    /** 软删时间：删除仅置该字段，历史订单/配送档案对自提点的引用仍可解析 */
    deletedAt: Date | null;
    channels: Channel[];
    customFields: CustomPickupLocationFields;
}
export {};
