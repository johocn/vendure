"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_TRANSITIONS = void 0;
exports.STATE_TRANSITIONS = {
    Pending: ['Approved', 'Rejected'],
    Approved: ['Returning', 'Closed'],
    Rejected: [],
    Returning: ['Received', 'Closed'],
    Received: ['Refunded', 'RefundFailed'],
    RefundFailed: ['Refunded'], // 退款失败后可重试
    Refunded: [],
    Closed: [],
};
//# sourceMappingURL=types.js.map