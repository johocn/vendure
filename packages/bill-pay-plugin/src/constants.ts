export const loggerCtx = 'BillPayPlugin';
export const BILLPAY_PLUGIN_OPTIONS = Symbol('BILLPAY_PLUGIN_OPTIONS');

/** 委托单业务单号 / 微信 out_trade_no 前缀（区分券单 CS-*），回调按此前缀精确路由 */
export const BILLPAY_CODE_PREFIX = 'BP-';

/** 自定义权限名（注册到 config.authOptions.customPermissions，web-admin 角色勾选） */
export const BillPayPermissions = {
    BillPayManage: 'BillPayManage',
} as const;
