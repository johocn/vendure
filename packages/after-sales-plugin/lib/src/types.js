"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_TRANSITIONS = void 0;
exports.STATE_TRANSITIONS = {
    Pending: ['Approved', 'Rejected'],
    Approved: ['Returning', 'Closed'],
    Rejected: [],
    Returning: ['Received', 'Closed'],
    Received: ['Refunded'],
    Refunded: [],
    Closed: [],
};
//# sourceMappingURL=types.js.map