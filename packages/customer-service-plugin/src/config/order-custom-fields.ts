// e:\code\vendure\packages\customer-service-plugin\src\config\order-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const csOrderCustomFields: CustomFields = {
  Order: [
    {
      name: 'csNotes',
      type: 'struct',
      list: true,
      public: false,
      fields: [
        { name: 'content', type: 'string' },
        { name: 'createdBy', type: 'string' },
        { name: 'createdAt', type: 'datetime' },
      ],
    },
  ],
};
