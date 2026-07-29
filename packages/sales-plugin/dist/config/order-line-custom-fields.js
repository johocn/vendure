"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesOrderLineCustomFields = void 0;
exports.salesOrderLineCustomFields = {
    OrderLine: [
        { name: 'overwrittenPrice', type: 'int', nullable: true },
        { name: 'originalPrice', type: 'int', nullable: true },
        { name: 'modifiedBy', type: 'string', nullable: true },
        { name: 'modifiedAt', type: 'datetime', nullable: true },
    ],
};
