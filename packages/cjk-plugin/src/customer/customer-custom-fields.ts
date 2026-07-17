import { CustomFields } from '@vendure/core';

export const customerCustomFields: CustomFields = {
    Customer: [
        {
            name: 'inviteCode',
            type: 'string',
            nullable: true,
            public: false,
        },
    ],
};
