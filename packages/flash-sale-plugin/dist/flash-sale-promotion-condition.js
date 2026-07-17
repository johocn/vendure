"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flashSaleDiscountCondition = void 0;
const core_1 = require("@vendure/core");
exports.flashSaleDiscountCondition = new core_1.PromotionCondition({
    code: 'flash_sale_discount',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '秒杀优惠' },
        { languageCode: core_1.LanguageCode.en, value: 'Flash Sale Discount' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = order.customFields;
        return (ocf === null || ocf === void 0 ? void 0 : ocf.flashSaleActivityId) != null;
    },
    priorityValue: 950,
});
//# sourceMappingURL=flash-sale-promotion-condition.js.map