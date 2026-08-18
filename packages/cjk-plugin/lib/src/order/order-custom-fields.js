"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderCustomFields = void 0;
const core_1 = require("@vendure/core");
const pickup_location_entity_1 = require("../pickup/pickup-location.entity");
exports.orderCustomFields = {
    Order: [
        {
            name: 'selectedPickupLocationId',
            type: 'relation',
            entity: pickup_location_entity_1.PickupLocation,
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '选中的自提点' },
                { languageCode: core_1.LanguageCode.en, value: 'Selected Pickup Location' },
                { languageCode: core_1.LanguageCode.ja, value: '選択した受取場所' },
                { languageCode: core_1.LanguageCode.ko, value: '선택된 수거 장소' },
            ],
        },
        {
            name: 'pickupType',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提类型' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Type' },
                { languageCode: core_1.LanguageCode.ja, value: '受取タイプ' },
                { languageCode: core_1.LanguageCode.ko, value: '수거 유형' },
            ],
        },
        {
            // 自提点坐标快照：就近分配锚点。deliveryType=pickup 且选自提点时，由 setOrderPickupLocation 写入，
            // NearestStockLocationStrategy 用它替代顾客定位做就近排序，避免依赖前端回传坐标。
            name: 'pickupLat',
            type: 'float',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '自提点纬度' }],
        },
        {
            name: 'pickupLng',
            type: 'float',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '自提点经度' }],
        },
        {
            // 自提核销标记：交付到点后由 confirmPickupHandover 置为 true，推动 Fulfillment → Delivered。
            name: 'pickupClaimed',
            type: 'boolean',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提已核销' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Claimed' },
            ],
        },
        {
            name: 'shippingProfileSnapshot',
            type: 'text',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '配送档案快照' },
            ],
        },
        {
            name: 'paymentProfileSnapshot',
            type: 'text',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '支付档案快照' },
            ],
        },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map