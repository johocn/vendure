import { CustomFields } from '@vendure/core';

export const alipayCustomerCustomFields: CustomFields = {
    Customer: [
        { name: 'alipayOpenid', type: 'string', nullable: true, public: true },
    ],
};
