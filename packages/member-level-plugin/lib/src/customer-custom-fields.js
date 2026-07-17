"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberLevelCustomerCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.memberLevelCustomerCustomFields = {
    Customer: [
        {
            name: 'growthValue',
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '成长值' }],
        },
        {
            name: 'points',
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '积分余额' }],
        },
        {
            name: 'memberLevel',
            type: 'int',
            defaultValue: 1,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '会员等级(1-5)' }],
        },
    ],
};
//# sourceMappingURL=customer-custom-fields.js.map