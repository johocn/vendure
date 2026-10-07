"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_TRANSITIONS = void 0;
exports.STATE_TRANSITIONS = {
    Pending: ['Approved', 'Rejected'],
    Approved: ['Returning', 'Received', 'Closed'], // +Received：refund_only 免退货直达退款
    Rejected: ['Appealed', 'Closed'], // +Appealed：用户申诉入口
    Appealed: ['Approved', 'Closed'], // 仲裁：同意退款 / 维持拒绝
    Returning: ['Received', 'Closed'],
    Received: ['Refunded', 'RefundFailed', 'ExchangeShipped'],
    ExchangeShipped: ['Closed'], // 换货已发货 → 顾客确认收货即关闭
    RefundFailed: ['Refunded'], // 退款失败后可重试
    Refunded: [],
    Closed: [],
};
//# sourceMappingURL=types.js.map