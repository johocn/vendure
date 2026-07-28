import { CustomFields } from '@vendure/core';

export const deliveryAddressCustomFields: CustomFields = {
  Address: [
    { name: 'latitude',  type: 'float', nullable: true },
    { name: 'longitude', type: 'float', nullable: true },
  ],
};
