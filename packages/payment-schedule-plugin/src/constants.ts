import { PermissionDefinition } from '@vendure/core';

export const loggerCtx = 'PaymentSchedulePlugin';
export const PAYMENT_SCHEDULE_PLUGIN_OPTIONS = Symbol('PAYMENT_SCHEDULE_PLUGIN_OPTIONS');

/**
 * 收付款计划操作权限（店长/运营专用）。
 * 刻意不复用 Vendure 原生 UpdateOrder：该权限同时放开改单/改价等订单编辑能力，
 * 而这里的语义仅是「确认 COD 收款 / 释放租赁押金 / 开尾款窗口 / 确认卖家违约」。
 */
export const ManagePaymentSchedulePermissionDefinition = new PermissionDefinition({
    name: 'ManagePaymentSchedule',
    description: '确认货到付款收款、释放租赁押金、开启尾款窗口、确认卖家违约',
});

export const paymentSchedulePermissionDefinitions: PermissionDefinition[] = [
    ManagePaymentSchedulePermissionDefinition,
];
