"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesCustomerCustomFields = void 0;
exports.salesCustomerCustomFields = {
    Customer: [
        {
            name: 'customerType',
            type: 'string',
            nullable: false,
            defaultValue: 'individual',
            public: true,
        },
        { name: 'companyInfo', type: 'string', nullable: true, public: true },
        { name: 'salesStaffId', type: 'string', nullable: true, public: false },
        { name: 'customerTags', type: 'string', list: true, public: true },
    ],
};
