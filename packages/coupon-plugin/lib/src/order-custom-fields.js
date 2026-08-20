"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.couponOrderCustomFields = {
    Order: [
        { name: 'couponCode', type: 'string', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '优惠券码' }] },
        { name: 'couponId', type: 'int', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '用户优惠券ID' }] },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map