import { DeepPartial, VendureEntity } from '@vendure/core';
import { LocalizedText } from './localize';
import { Merchant } from './merchant.entity';
/** 结构化营业时间（与 business-hours.ts 的 StructuredBusinessHours 对应） */
export type StructuredBusinessHoursJson = Record<string, unknown>;
/**
 * 门店：商户下的经营单元（可多门店）。
 *
 * 门店独立于租户存在，租户通过 merchant_store_channel 认领绑定；优惠券、外卖、自提
 * 等后续只引用 merchant_store.id。
 */
export declare class MerchantStore extends VendureEntity {
    constructor(input?: DeepPartial<MerchantStore>);
    /** 所属商户 id */
    merchantId: number;
    merchant?: Merchant;
    /** 门店编码（全局唯一，如 PL-8 / CF-3） */
    code: string;
    /** 门店名称（LocalizedText） */
    name: LocalizedText;
    /** 门店类型 DIRECT | FRANCHISE | ... */
    storeType: string;
    /** 排序（升序） */
    sortOrder: number;
    /** 权重（降序，用于同排序下的加权） */
    weight: number;
    country: string;
    province: string | null;
    city: string | null;
    /** 城市行政编码 */
    cityCode: string | null;
    district: string | null;
    street: string | null;
    /** 街道及门牌 */
    addressLine: string | null;
    /** 楼层 / 铺位等细节 */
    detail: string | null;
    postalCode: string | null;
    lat: number | null;
    lng: number | null;
    /** 坐标系 GCJ02 | WGS84 | BD09 */
    coordinateSystem: string;
    geohash: string | null;
    /** 地图 POI 唯一标识 */
    mapPoiId: string | null;
    /** 地图服务商 amap | baidu | tencent */
    mapProvider: string | null;
    /** 导航用地址（可与展示地址不同） */
    navigationAddress: string | null;
    phoneNumber: string | null;
    backupPhone: string | null;
    managerName: string | null;
    managerPhone: string | null;
    wechat: string | null;
    servicePhone: string | null;
    /** 结构化营业时间（simple-json） */
    businessHours: StructuredBusinessHoursJson | null;
    /** 营业时间文案（如 "09:00-21:00"） */
    businessHoursText: string | null;
    /** 门店时区 */
    timezone: string;
    /** 特殊营业日（simple-json：SpecialDate[]） */
    specialDates: Record<string, unknown>[] | null;
    /** 节假日营业方案（simple-json） */
    holidayPlan: Record<string, unknown> | null;
    /** 门店状态 OPEN | CLOSED | SUSPENDED | ... */
    status: string;
    statusNote: string | null;
    /** 重新营业时间（如暂停营业时预告） */
    reopenAt: Date | null;
    /** 是否接单 */
    acceptingOrders: boolean;
    coverImage: string | null;
    photos: string[] | null;
    videos: string[] | null;
    panoramaUrl: string | null;
    /** 门店公告（LocalizedText） */
    notice: LocalizedText | null;
    tags: string[] | null;
    /** 设施标签 */
    facilities: string[] | null;
    /** 是否支持券核销 */
    supportsRedemption: boolean;
    /** 可核销时段文案 */
    redemptionHours: string | null;
    /** 每日核销上限 */
    dailyRedeemLimit: number | null;
    requiresReservation: boolean;
    reservationPhone: string | null;
    supportsDelivery: boolean;
    /** 配送半径（公里） */
    deliveryRadiusKm: number | null;
    /** 配送费（分） */
    deliveryFee: number | null;
    /** 起送价（分） */
    minOrderAmount: number | null;
    /** 预计配送时长（分钟） */
    deliveryMinutes: number | null;
    /** 外部系统映射（simple-json，如 { meituan: 'xx' }） */
    externalIds: Record<string, unknown> | null;
    /** 数据来源 MANUAL | MIGRATION | SYNC */
    source: string;
    lastSyncAt: Date | null;
    /** 是否对 C 端公开 */
    isPublic: boolean;
    enabled: boolean;
    createdBy: string | null;
    updatedBy: string | null;
    /** 软删除时间；查询默认过滤 deletedAt is null */
    deletedAt: Date | null;
}
