"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.couponOrderCustomFields = {
    Order: [
        {
            name: 'appliedCouponCode',
            type: 'string',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '已使用优惠券码' }],
        },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map