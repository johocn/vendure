import { CustomFields, LanguageCode } from '@vendure/core';
import { PickupLocation } from '../pickup/pickup-location.entity';

export const orderCustomFields: CustomFields = {
    Order: [
        {
            name: 'selectedPickupLocationId',
            type: 'relation',
            entity: PickupLocation,
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '选中的自提点' },
                { languageCode: LanguageCode.en, value: 'Selected Pickup Location' },
                { languageCode: LanguageCode.ja, value: '選択した受取場所' },
                { languageCode: LanguageCode.ko, value: '선택된 수거 장소' },
            ],
        },
        {
            name: 'pickupType',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提类型' },
                { languageCode: LanguageCode.en, value: 'Pickup Type' },
                { languageCode: LanguageCode.ja, value: '受取タイプ' },
                { languageCode: LanguageCode.ko, value: '수거 유형' },
            ],
        },
        {
            name: 'shippingProfileSnapshot',
            type: 'text',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '配送档案快照' },
            ],
        },
        {
            name: 'paymentProfileSnapshot',
            type: 'text',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '支付档案快照' },
            ],
        },
    ],
};
