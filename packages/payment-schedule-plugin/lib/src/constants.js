"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentSchedulePermissionDefinitions = exports.ManagePaymentSchedulePermissionDefinition = exports.PAYMENT_SCHEDULE_PLUGIN_OPTIONS = exports.loggerCtx = void 0;
const core_1 = require("@vendure/core");
exports.loggerCtx = 'PaymentSchedulePlugin';
exports.PAYMENT_SCHEDULE_PLUGIN_OPTIONS = Symbol('PAYMENT_SCHEDULE_PLUGIN_OPTIONS');
/**
 * 收付款计划操作权限（店长/运营专用）。
 * 刻意不复用 Vendure 原生 UpdateOrder：该权限同时放开改单/改价等订单编辑能力，
 * 而这里的语义仅是「确认 COD 收款 / 释放租赁押金 / 开尾款窗口 / 确认卖家违约」。
 */
exports.ManagePaymentSchedulePermissionDefinition = new core_1.PermissionDefinition({
    name: 'ManagePaymentSchedule',
    description: '确认货到付款收款、释放租赁押金、开启尾款窗口、确认卖家违约',
});
exports.paymentSchedulePermissionDefinitions = [
    exports.ManagePaymentSchedulePermissionDefinition,
];
