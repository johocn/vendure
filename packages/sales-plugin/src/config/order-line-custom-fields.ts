// e:\code\vendure\packages\sales-plugin\src\config\order-line-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const salesOrderLineCustomFields: CustomFields = {
  OrderLine: [
    { name: 'overwrittenPrice', type: 'int',      nullable: true },
    { name: 'originalPrice',    type: 'int',      nullable: true },
    { name: 'modifiedBy',       type: 'string',   nullable: true },
    { name: 'modifiedAt',       type: 'datetime', nullable: true },
  ],
};
