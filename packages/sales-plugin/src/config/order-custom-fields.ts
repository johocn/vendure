// e:\code\vendure\packages\sales-plugin\src\config\order-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const salesOrderCustomFields: CustomFields = {
  Order: [
    { name: 'salesStaffId', type: 'string', nullable: true, public: false },
    { name: 'salesChannel', type: 'string', nullable: true, public: false },
    { name: 'salesNote',    type: 'string', nullable: true, public: false },
  ],
};
