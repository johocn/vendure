import { CustomFields, LanguageCode } from '@vendure/core';

/**
 * 券店营销扩展 customFields：
 * - Channel.firstBuyDiscount：首购立减（分），全店统一，0/null=关闭（web-admin 租户管理可配）
 * - Channel.couponCampaign：倒计时活动位配置（JSON 字符串，单场；null/坏 JSON=无活动）
 * - Channel.billpay*：买单券监管参数组（T4，全部可空 = 宽松默认，配置后才启用校验）：
 *   billpayMaxSalePrice 售价上限（分）/ billpayMaxFaceValue 单券面额上限（分，仅 FIXED/FULL/FREE_SHIPPING
 *   静态可折算，PERCENT 跳过）/ billpayMaxBundleTotal 券包总面额上限（分）/ billpayMinValidDays
 *   最短有效天数 / billpayExpireRefundPolicy 过期退款策略（P0 仅存档展示，不强制）
 * - Customer.student*：学生认证人工审核流（C 端申请 → 后台审核 → approved 生效学生价）
 * 列结构由 AddCouponPromoFieldsMigration 幂等补齐（生产关闭 synchronize）。
 */
const zh = (value: string) => [{ languageCode: LanguageCode.zh_Hans, value }];

export const couponPromoCustomFields: CustomFields = {
    Channel: [
        { name: 'firstBuyDiscount', type: 'int', nullable: true, label: zh('首购立减（分）') },
        { name: 'couponCampaign', type: 'string', length: 4096, nullable: true, label: zh('倒计时活动配置(JSON)') },
        { name: 'billpayMaxSalePrice', type: 'int', nullable: true, label: zh('买单券售价上限（分）') },
        { name: 'billpayMaxFaceValue', type: 'int', nullable: true, label: zh('买单券单券面额上限（分）') },
        { name: 'billpayMaxBundleTotal', type: 'int', nullable: true, label: zh('买单券券包总面额上限（分）') },
        { name: 'billpayMinValidDays', type: 'int', nullable: true, label: zh('买单券最短有效天数') },
        { name: 'billpayExpireRefundPolicy', type: 'string', nullable: true, label: zh('过期退款策略') },
    ],
    Customer: [
        { name: 'studentStatus', type: 'string', nullable: true, label: zh('学生认证状态') },
        { name: 'studentInfo', type: 'string', nullable: true, label: zh('学生认证资料(JSON)') },
        { name: 'studentReviewedAt', type: 'datetime', nullable: true, label: zh('学生认证审核时间') },
    ],
};
