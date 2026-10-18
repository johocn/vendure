"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponPromoCustomFields = void 0;
const core_1 = require("@vendure/core");
/**
 * 券店营销扩展 customFields：
 * - Channel.firstBuyDiscount：首购立减（分），全店统一，0/null=关闭（web-admin 租户管理可配）
 * - Channel.couponCampaign：倒计时活动位配置（JSON 字符串，单场；null/坏 JSON=无活动）
 * - Customer.student*：学生认证人工审核流（C 端申请 → 后台审核 → approved 生效学生价）
 * 列结构由 AddCouponPromoFieldsMigration 幂等补齐（生产关闭 synchronize）。
 */
const zh = (value) => [{ languageCode: core_1.LanguageCode.zh_Hans, value }];
exports.couponPromoCustomFields = {
    Channel: [
        { name: 'firstBuyDiscount', type: 'int', nullable: true, label: zh('首购立减（分）') },
        { name: 'couponCampaign', type: 'string', nullable: true, label: zh('倒计时活动配置(JSON)') },
    ],
    Customer: [
        { name: 'studentStatus', type: 'string', nullable: true, label: zh('学生认证状态') },
        { name: 'studentInfo', type: 'string', nullable: true, label: zh('学生认证资料(JSON)') },
        { name: 'studentReviewedAt', type: 'datetime', nullable: true, label: zh('学生认证审核时间') },
    ],
};
//# sourceMappingURL=promo-custom-fields.js.map