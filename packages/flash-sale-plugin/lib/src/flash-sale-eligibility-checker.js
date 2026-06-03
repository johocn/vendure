"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flashSaleEligibilityCondition = void 0;
const core_1 = require("@vendure/core");
exports.flashSaleEligibilityCondition = new core_1.PromotionCondition({
    code: 'flash_sale_eligibility',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '秒杀资格检查' },
        { languageCode: core_1.LanguageCode.en, value: 'Flash Sale Eligibility' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = order.customFields;
        if (!(ocf === null || ocf === void 0 ? void 0 : ocf.flashSaleActivityId))
            return true;
        const now = new Date();
        const startAt = ocf === null || ocf === void 0 ? void 0 : ocf.flashSaleStartAt;
        const endAt = ocf === null || ocf === void 0 ? void 0 : ocf.flashSaleEndAt;
        if (startAt && now < new Date(startAt))
            return false;
        if (endAt && now > new Date(endAt))
            return false;
        return true;
    },
    priorityValue: 960,
});
//# sourceMappingURL=flash-sale-eligibility-checker.js.map