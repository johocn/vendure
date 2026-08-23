import { CustomFields } from '@vendure/core';

export const customShippingMethodFields: CustomFields = {
    ShippingMethod: [
        { name: 'enabled', type: 'boolean', defaultValue: true, nullable: false },
    ],
};