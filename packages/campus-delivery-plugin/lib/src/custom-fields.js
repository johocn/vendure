"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusCustomFields = void 0;
exports.campusCustomFields = {
    Order: [
        { name: 'fulfillmentRoute', type: 'string', nullable: true }, // R1..R5
        { name: 'orderKind', type: 'string', nullable: true, defaultValue: 'normal' },
        { name: 'buildingId', type: 'string', nullable: true },
        { name: 'campusZone', type: 'string', nullable: true },
        { name: 'hallStatus', type: 'string', nullable: true }, // open/grabbed
        { name: 'hallEnteredAt', type: 'datetime', nullable: true },
        { name: 'riderEarning', type: 'int', nullable: true },
        { name: 'tip', type: 'int', nullable: true },
    ],
    Customer: [
        { name: 'riderStatus', type: 'string', nullable: true }, // none/pending/approved/suspended
        { name: 'riderRealName', type: 'string', nullable: true },
        { name: 'riderStudentNo', type: 'string', nullable: true },
        { name: 'riderCampus', type: 'string', nullable: true },
        { name: 'riderIdImg', type: 'string', nullable: true },
        { name: 'riderCredit', type: 'int', nullable: true, defaultValue: 100 },
    ],
};
//# sourceMappingURL=custom-fields.js.map