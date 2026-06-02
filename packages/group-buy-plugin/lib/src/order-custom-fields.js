"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupBuyOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.groupBuyOrderCustomFields = {
    Order: [
        { name: 'groupBuyActivityId', type: 'int', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '拼团活动ID' }] },
        { name: 'groupBuyIsLeader', type: 'boolean', defaultValue: false, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '是否团长' }] },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map