import { DeepPartial, VendureEntity } from '@vendure/core';
import { LocalizedText } from './localize';
/**
 * 商户主数据（与租户 Channel 解耦）。
 *
 * 门店、优惠券、外卖、自提等业务只通过 merchant / merchant_store 的 id 建立引用，
 * 租户与门店的关系落在 merchant_store_channel（认领关系表），可选绑定、可撤销。
 */
export declare class Merchant extends VendureEntity {
    constructor(input?: DeepPartial<Merchant>);
    /** 商户编码（全局唯一，如 PL-M-12 / CF-M-3） */
    code: string;
    /** 商户名称（LocalizedText：纯字符串或按 LanguageCode 键的多语言映射） */
    name: LocalizedText;
    /** 简称 / 门头名 */
    shortName: string | null;
    /** 商户 logo */
    logo: string | null;
    /** 品牌名 */
    brand: string | null;
    /** 商户介绍（LocalizedText，可空） */
    intro: LocalizedText | null;
    /** 商户标签 */
    tags: string[] | null;
    /** 主体名称（营业执照主体） */
    legalName: string | null;
    /** 营业执照号 */
    licenseNo: string | null;
    /** 营业执照照片 */
    licenseImage: string | null;
    /** 执照有效期至 */
    licenseExpiry: Date | null;
    /** 主体类型 ENTERPRISE | INDIVIDUAL | ... */
    merchantType: string;
    /** 所属行业 */
    industry: string | null;
    /** 业态分类 */
    category: string | null;
    /** 联系人 */
    contactName: string | null;
    /** 联系人电话 */
    contactPhone: string | null;
    /** 客服电话 */
    servicePhone: string | null;
    /** 投诉电话 */
    complaintPhone: string | null;
    email: string | null;
    wechat: string | null;
    province: string | null;
    city: string | null;
    district: string | null;
    street: string | null;
    address: string | null;
    /** 归属租户渠道 id（仅用于溯源，不参与可见性隔离） */
    ownerChannelId: number | null;
    /** 认领状态 UNCLAIMED | CLAIMED | REVOKED */
    claimStatus: string;
    contractNo: string | null;
    /** 合作开始时间 */
    cooperationStart: Date | null;
    /** 合作结束时间 */
    cooperationEnd: Date | null;
    /** 佣金比例（万分比，如 500 = 5%） */
    commissionRate: number | null;
    /** 数据来源 MANUAL | MIGRATION | ... */
    source: string;
    settlementType: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNo: string | null;
    taxNo: string | null;
    invoiceTitle: string | null;
    /** 商户状态 ACTIVE | SUSPENDED | CLOSED */
    status: string;
    statusReason: string | null;
    closedAt: Date | null;
}
