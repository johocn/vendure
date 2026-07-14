import { CustomFields } from '@vendure/core';

export const douyinCustomerCustomFields: CustomFields = {
    Customer: [
        { name: 'douyinOpenid', type: 'string', nullable: true, public: true },
    ],
};
