"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotelOrderLineCustomFields = void 0;
const core_1 = require("@vendure/core");
// 酒店订单行字段：入住/离店日期（date-only，避免时区漂移）+ 晚数冗余。
// 声明后 Vendure 会自动给 addItemToOrder / adjustOrderLine 注入 customFields 参数。
exports.hotelOrderLineCustomFields = {
    OrderLine: [
        {
            name: 'hotelCheckIn',
            type: 'string',
            public: true,
            nullable: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '入住日期' },
                { languageCode: core_1.LanguageCode.en, value: 'Check-in date' },
            ],
        },
        {
            name: 'hotelCheckOut',
            type: 'string',
            public: true,
            nullable: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '离店日期' },
                { languageCode: core_1.LanguageCode.en, value: 'Check-out date' },
            ],
        },
        {
            name: 'hotelNights',
            type: 'int',
            public: true,
            nullable: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '入住晚数' },
                { languageCode: core_1.LanguageCode.en, value: 'Nights' },
            ],
        },
    ],
};
//# sourceMappingURL=hotel-order-line-custom-fields.js.map