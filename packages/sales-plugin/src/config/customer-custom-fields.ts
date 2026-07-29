// e:\code\vendure\packages\sales-plugin\src\config\customer-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const salesCustomerCustomFields: CustomFields = {
  Customer: [
    {
      name: 'customerType',
      type: 'string',
      nullable: false,
      defaultValue: 'individual',
      public: true,
    },
    { name: 'companyInfo',  type: 'string', nullable: true,  public: true },
    { name: 'salesStaffId', type: 'string', nullable: true,  public: false },
    { name: 'customerTags', type: 'string', list: true,      public: true },
  ],
};
