"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryOrderCustomFields = void 0;
exports.deliveryOrderCustomFields = {
    Order: [
        { name: 'deliveryStaffId', type: 'string', nullable: true },
        { name: 'deliveryStatus', type: 'string', nullable: true },
        { name: 'assignedAt', type: 'datetime', nullable: true },
        { name: 'deliveredAt', type: 'datetime', nullable: true },
        { name: 'deliveryPhotos', type: 'string', list: true, nullable: true },
        { name: 'deliveryNote', type: 'string', nullable: true },
        { name: 'exceptionType', type: 'string', nullable: true },
        { name: 'exceptionNote', type: 'string', nullable: true },
        { name: 'exceptionPhotos', type: 'string', list: true, nullable: true },
    ],
};
