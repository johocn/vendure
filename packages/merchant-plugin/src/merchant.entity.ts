﻿import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { LocalizedText, localizedTextColumn } from './localize';

/**
 * 商户主数据（与租户 Channel 解耦）。
 *
 * 门店、优惠券、外卖、自提等业务只通过 merchant / merchant_store 的 id 建立引用，
 * 租户与门店的关系落在 merchant_store_channel（认领关系表），可选绑定、可撤销。
 */
@Entity()
export class Merchant extends VendureEntity {
    constructor(input?: DeepPartial<Merchant>) {
        super(input);
    }

    /** 商户编码（全局唯一，如 PL-M-12 / CF-M-3） */
    @Column({ type: 'varchar', unique: true }) code: string;

    /** 商户名称（LocalizedText：纯字符串或按 LanguageCode 键的多语言映射） */
    @Column({ type: 'text', transformer: localizedTextColumn }) name: LocalizedText;

    /** 简称 / 门头名 */
    @Column({ type: 'varchar', nullable: true }) shortName: string | null;

    /** 商户 logo */
    @Column({ type: 'text', nullable: true }) logo: string | null;

    /** 品牌名 */
    @Column({ type: 'varchar', nullable: true }) brand: string | null;

    /** 商户介绍（LocalizedText，可空） */
    @Column({ type: 'text', nullable: true, transformer: localizedTextColumn }) intro: LocalizedText | null;

    /** 商户标签 */
    @Column({ type: 'simple-json', nullable: true }) tags: string[] | null;

    /** 主体名称（营业执照主体） */
    @Column({ type: 'varchar', nullable: true }) legalName: string | null;

    /** 营业执照号 */
    @Column({ type: 'varchar', nullable: true }) licenseNo: string | null;

    /** 营业执照照片 */
    @Column({ type: 'text', nullable: true }) licenseImage: string | null;

    /** 执照有效期至 */
    @Column({ type: Date, nullable: true }) licenseExpiry: Date | null;

    /** 主体类型 ENTERPRISE | INDIVIDUAL | ... */
    @Column({ type: 'varchar', default: 'ENTERPRISE' }) merchantType: string;

    /** 所属行业 */
    @Column({ type: 'varchar', nullable: true }) industry: string | null;

    /** 业态分类 */
    @Column({ type: 'varchar', nullable: true }) category: string | null;

    /** 联系人 */
    @Column({ type: 'varchar', nullable: true }) contactName: string | null;

    /** 联系人电话 */
    @Column({ type: 'varchar', nullable: true }) contactPhone: string | null;

    /** 客服电话 */
    @Column({ type: 'varchar', nullable: true }) servicePhone: string | null;

    /** 投诉电话 */
    @Column({ type: 'varchar', nullable: true }) complaintPhone: string | null;

    @Column({ type: 'varchar', nullable: true }) email: string | null;

    @Column({ type: 'varchar', nullable: true }) wechat: string | null;

    @Column({ type: 'varchar', nullable: true }) province: string | null;

    @Column({ type: 'varchar', nullable: true }) city: string | null;

    @Column({ type: 'varchar', nullable: true }) district: string | null;

    @Column({ type: 'varchar', nullable: true }) street: string | null;

    @Column({ type: 'varchar', nullable: true }) address: string | null;

    /** 归属租户渠道 id（仅用于溯源，不参与可见性隔离） */
    @Column({ type: 'int', nullable: true }) ownerChannelId: number | null;

    /** 认领状态 UNCLAIMED | CLAIMED | REVOKED */
    @Column({ type: 'varchar', default: 'UNCLAIMED' }) claimStatus: string;

    @Column({ type: 'varchar', nullable: true }) contractNo: string | null;

    /** 合作开始时间 */
    @Column({ type: Date, nullable: true }) cooperationStart: Date | null;

    /** 合作结束时间 */
    @Column({ type: Date, nullable: true }) cooperationEnd: Date | null;

    /** 佣金比例（万分比，如 500 = 5%） */
    @Column({ type: 'int', nullable: true }) commissionRate: number | null;

    /** 数据来源 MANUAL | MIGRATION | ... */
    @Column({ type: 'varchar', default: 'MANUAL' }) source: string;

    @Column({ type: 'varchar', nullable: true }) settlementType: string | null;

    @Column({ type: 'varchar', nullable: true }) bankName: string | null;

    @Column({ type: 'varchar', nullable: true }) bankAccountName: string | null;

    @Column({ type: 'varchar', nullable: true }) bankAccountNo: string | null;

    @Column({ type: 'varchar', nullable: true }) taxNo: string | null;

    @Column({ type: 'varchar', nullable: true }) invoiceTitle: string | null;

    /** 商户状态 ACTIVE | SUSPENDED | CLOSED */
    @Column({ type: 'varchar', default: 'ACTIVE' }) status: string;

    @Column({ type: 'varchar', nullable: true }) statusReason: string | null;

    @Column({ type: Date, nullable: true }) closedAt: Date | null;

    /** 软删除时间；列表/详情查询默认过滤已删除（生产库 DB_SYNC=0，列由迁移补齐） */
    @Column({ type: Date, nullable: true }) deletedAt: Date | null;
}
