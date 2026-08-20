"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberLevelOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.memberLevelOrderCustomFields = {
    Order: [
        {
            name: 'pointsToRedeem',
            type: 'int',
            defaultValue: 0,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '拟抵扣积分' }],
        },
        {
            name: 'pointsRedeemAmount',
            type: 'int',
            defaultValue: 0,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '积分抵扣金额(分)' }],
        },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map