"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributionCustomerCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.distributionCustomerCustomFields = {
    Customer: [
        { name: 'referralCode', type: 'string', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '推荐码' }] },
        { name: 'referredBy', type: 'string', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '推荐人推荐码' }] },
    ],
};
//# sourceMappingURL=customer-custom-fields.js.map