﻿import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { LocalizedText, localizedTextColumn } from './localize';
import { Merchant } from './merchant.entity';

/** 结构化营业时间（与 business-hours.ts 的 StructuredBusinessHours 对应） */
export type StructuredBusinessHoursJson = Record<string, unknown>;

/**
 * 门店：商户下的经营单元（可多门店）。
 *
 * 门店独立于租户存在，租户通过 merchant_store_channel 认领绑定；优惠券、外卖、自提
 * 等后续只引用 merchant_store.id。
 */
@Entity()
@Index(['merchantId'])
export class MerchantStore extends VendureEntity {
    constructor(input?: DeepPartial<MerchantStore>) {
        super(input);
    }

    /** 所属商户 id */
    @Column({ type: 'int' }) merchantId: number;

    @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'merchantId' })
    merchant?: Merchant;

    /** 门店编码（全局唯一，如 PL-8 / CF-3） */
    @Column({ type: 'varchar', unique: true }) code: string;

    /** 门店名称（LocalizedText） */
    @Column({ type: 'text', transformer: localizedTextColumn }) name: LocalizedText;

    /** 门店类型 DIRECT | FRANCHISE | ... */
    @Column({ type: 'varchar', default: 'DIRECT' }) storeType: string;

    /** 排序（升序） */
    @Column({ type: 'int', default: 0 }) sortOrder: number;

    /** 权重（降序，用于同排序下的加权） */
    @Column({ type: 'int', default: 0 }) weight: number;

    @Column({ type: 'varchar', default: 'CN' }) country: string;

    @Column({ type: 'varchar', nullable: true }) province: string | null;

    @Column({ type: 'varchar', nullable: true }) city: string | null;

    /** 城市行政编码 */
    @Column({ type: 'varchar', nullable: true }) cityCode: string | null;

    @Column({ type: 'varchar', nullable: true }) district: string | null;

    @Column({ type: 'varchar', nullable: true }) street: string | null;

    /** 街道及门牌 */
    @Column({ type: 'varchar', nullable: true }) addressLine: string | null;

    /** 楼层 / 铺位等细节 */
    @Column({ type: 'varchar', nullable: true }) detail: string | null;

    @Column({ type: 'varchar', nullable: true }) postalCode: string | null;

    @Column({ type: 'float', nullable: true }) lat: number | null;

    @Column({ type: 'float', nullable: true }) lng: number | null;

    /** 坐标系 GCJ02 | WGS84 | BD09 */
    @Column({ type: 'varchar', default: 'GCJ02' }) coordinateSystem: string;

    @Column({ type: 'varchar', nullable: true }) geohash: string | null;

    /** 地图 POI 唯一标识 */
    @Column({ type: 'varchar', nullable: true }) mapPoiId: string | null;

    /** 地图服务商 amap | baidu | tencent */
    @Column({ type: 'varchar', nullable: true }) mapProvider: string | null;

    /** 导航用地址（可与展示地址不同） */
    @Column({ type: 'varchar', nullable: true }) navigationAddress: string | null;

    @Column({ type: 'varchar', nullable: true }) phoneNumber: string | null;

    @Column({ type: 'varchar', nullable: true }) backupPhone: string | null;

    @Column({ type: 'varchar', nullable: true }) managerName: string | null;

    @Column({ type: 'varchar', nullable: true }) managerPhone: string | null;

    @Column({ type: 'varchar', nullable: true }) wechat: string | null;

    @Column({ type: 'varchar', nullable: true }) servicePhone: string | null;

    /** 结构化营业时间（simple-json） */
    @Column({ type: 'simple-json', nullable: true }) businessHours: StructuredBusinessHoursJson | null;

    /** 营业时间文案（如 "09:00-21:00"） */
    @Column({ type: 'varchar', nullable: true }) businessHoursText: string | null;

    /** 门店时区 */
    @Column({ type: 'varchar', default: 'Asia/Shanghai' }) timezone: string;

    /** 特殊营业日（simple-json：SpecialDate[]） */
    @Column({ type: 'simple-json', nullable: true }) specialDates: Record<string, unknown>[] | null;

    /** 节假日营业方案（simple-json） */
    @Column({ type: 'simple-json', nullable: true }) holidayPlan: Record<string, unknown> | null;

    /** 门店状态 OPEN | CLOSED | SUSPENDED | ... */
    @Column({ type: 'varchar', default: 'OPEN' }) status: string;

    @Column({ type: 'varchar', nullable: true }) statusNote: string | null;

    /** 重新营业时间（如暂停营业时预告） */
    @Column({ type: 'datetime', nullable: true }) reopenAt: Date | null;

    /** 是否接单 */
    @Column({ type: 'boolean', default: true }) acceptingOrders: boolean;

    @Column({ type: 'text', nullable: true }) coverImage: string | null;

    @Column({ type: 'simple-json', nullable: true }) photos: string[] | null;

    @Column({ type: 'simple-json', nullable: true }) videos: string[] | null;

    @Column({ type: 'text', nullable: true }) panoramaUrl: string | null;

    /** 门店公告（LocalizedText） */
    @Column({ type: 'text', nullable: true, transformer: localizedTextColumn }) notice: LocalizedText | null;

    @Column({ type: 'simple-json', nullable: true }) tags: string[] | null;

    /** 设施标签 */
    @Column({ type: 'simple-json', nullable: true }) facilities: string[] | null;

    /** 是否支持券核销 */
    @Column({ type: 'boolean', default: true }) supportsRedemption: boolean;

    /** 可核销时段文案 */
    @Column({ type: 'varchar', nullable: true }) redemptionHours: string | null;

    /** 每日核销上限 */
    @Column({ type: 'int', nullable: true }) dailyRedeemLimit: number | null;

    @Column({ type: 'boolean', default: false }) requiresReservation: boolean;

    @Column({ type: 'varchar', nullable: true }) reservationPhone: string | null;

    @Column({ type: 'boolean', default: false }) supportsDelivery: boolean;

    /** 配送半径（公里） */
    @Column({ type: 'int', nullable: true }) deliveryRadiusKm: number | null;

    /** 配送费（分） */
    @Column({ type: 'int', nullable: true }) deliveryFee: number | null;

    /** 起送价（分） */
    @Column({ type: 'int', nullable: true }) minOrderAmount: number | null;

    /** 预计配送时长（分钟） */
    @Column({ type: 'int', nullable: true }) deliveryMinutes: number | null;

    /** 外部系统映射（simple-json，如 { meituan: 'xx' }） */
    @Column({ type: 'simple-json', nullable: true }) externalIds: Record<string, unknown> | null;

    /** 数据来源 MANUAL | MIGRATION | SYNC */
    @Column({ type: 'varchar', default: 'MANUAL' }) source: string;

    @Column({ type: 'datetime', nullable: true }) lastSyncAt: Date | null;

    /** 是否对 C 端公开 */
    @Column({ type: 'boolean', default: true }) isPublic: boolean;

    @Column({ type: 'boolean', default: true }) enabled: boolean;

    @Column({ type: 'varchar', nullable: true }) createdBy: string | null;

    @Column({ type: 'varchar', nullable: true }) updatedBy: string | null;

    /** 软删除时间；查询默认过滤 deletedAt is null */
    @Column({ type: 'datetime', nullable: true }) deletedAt: Date | null;
}
