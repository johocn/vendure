export declare const loggerCtx = "BillPayPlugin";
export declare const BILLPAY_PLUGIN_OPTIONS: unique symbol;
/** 委托单业务单号 / 微信 out_trade_no 前缀（区分券单 CS-*），回调按此前缀精确路由 */
export declare const BILLPAY_CODE_PREFIX = "BP-";
/** 自定义权限名（注册到 config.authOptions.customPermissions，web-admin 角色勾选） */
export declare const BillPayPermissions: {
    readonly BillPayManage: "BillPayManage";
};
