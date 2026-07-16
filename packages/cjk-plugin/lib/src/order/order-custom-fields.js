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
    ],
};
//# sourceMappingURL=order-custom-fields.js.map