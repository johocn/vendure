import { CustomFields, LanguageCode } from '@vendure/core';

// 酒店订单行字段：入住/离店日期（date-only，避免时区漂移）+ 晚数冗余。
// 声明后 Vendure 会自动给 addItemToOrder / adjustOrderLine 注入 customFields 参数。
export const hotelOrderLineCustomFields: CustomFields = {
    OrderLine: [
        {
            name: 'hotelCheckIn',
            type: 'string',
            public: true,
            nullable: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '入住日期' },
                { languageCode: LanguageCode.en, value: 'Check-in date' },
            ],
        },
        {
            name: 'hotelCheckOut',
            type: 'string',
            public: true,
            nullable: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '离店日期' },
                { languageCode: LanguageCode.en, value: 'Check-out date' },
            ],
        },
        {
            name: 'hotelNights',
            type: 'int',
            public: true,
            nullable: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '入住晚数' },
                { languageCode: LanguageCode.en, value: 'Nights' },
            ],
        },
        {
            // P2 房价方案码：套用 HotelRatePlan（坏 code / 不可用 → 计价策略回退基价）
            name: 'ratePlanCode',
            type: 'string',
            public: true,
            nullable: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '房价方案' },
                { languageCode: LanguageCode.en, value: 'Rate plan' },
            ],
        },
    ],
};
