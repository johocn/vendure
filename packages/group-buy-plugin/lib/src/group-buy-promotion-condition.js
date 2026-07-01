"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyDiscountCondition = void 0;
const core_1 = require("@vendure/core");
exports.groupBuyDiscountCondition = new core_1.PromotionCondition({
    code: 'group_buy_discount',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '拼团优惠' },
        { languageCode: core_1.LanguageCode.en, value: 'Group Buy Discount' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = order.customFields;
        return (ocf === null || ocf === void 0 ? void 0 : ocf.groupBuyActivityId) != null;
    },
    priorityValue: 900,
});
//# sourceMappingURL=group-buy-promotion-condition.js.map