"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
/** 四期增长闭环：评价有礼与追评窗口的渠道级配置（存 Channel customFields，admin 可视可改）。 */
exports.reviewChannelCustomFields = {
    Channel: [
        {
            name: 'reviewGiftCouponTemplateId',
            type: 'string',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '评价有礼：奖励券模板 ID（空=不发券）' }],
            description: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '主评价审核通过后自动发放该优惠券模板；留空表示不启用发券奖励' },
            ],
        },
        {
            name: 'reviewGiftPoints',
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '评价有礼：奖励积分（0=不发）' }],
        },
        {
            name: 'reviewFollowUpWindowDays',
            type: 'int',
            defaultValue: 7,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '追评窗口（天，0=不允许追评）' }],
        },
    ],
};
//# sourceMappingURL=review-channel-custom-fields.js.map