import { CrudPermissionDefinition } from '@vendure/core';
export declare const POS_PERMISSIONS: {
    readonly TERMINAL_READ: "PosTerminal.Read";
    readonly TERMINAL_CREATE: "PosTerminal.Create";
    readonly TERMINAL_UPDATE: "PosTerminal.Update";
    readonly TERMINAL_DELETE: "PosTerminal.Delete";
    readonly SESSION_READ: "PosSession.Read";
    readonly SESSION_OPEN: "PosSession.Open";
    readonly SESSION_CLOSE: "PosSession.Close";
    readonly SESSION_APPROVE: "PosSession.Approve";
    readonly ORDER_ADD_ITEM: "PosOrder.AddItem";
    readonly ORDER_CHECKOUT: "PosOrder.Checkout";
    readonly ORDER_REFUND: "Order.Refund.Create";
    readonly PRODUCT_READ: "PosProduct.Read";
    readonly MEMBER_READ: "PosMember.Read";
    readonly ORDER_SYNC: "PosOrder.Sync";
};
/**
 * PosTerminal CRUD 权限定义（用于 @Allow 装饰器与 authOptions.customPermissions 注册）。
 * 生成 CreatePosTerminal / ReadPosTerminal / UpdatePosTerminal / DeletePosTerminal 四个权限。
 */
export declare const posTerminalPermission: CrudPermissionDefinition;
/**
 * PosSession CRUD 权限定义。Create/Update 对应开班/关班动作。
 */
export declare const posSessionPermission: CrudPermissionDefinition;
export declare const POS_SESSION_STATE: {
    readonly OPEN: "open";
    readonly CLOSED: "closed";
};
export declare const ORDER_TYPE: {
    readonly SALE: "sale";
    readonly REFUND: "refund";
    readonly HOLD: "hold";
};
export declare const AGGREGATE_PAY_STATUS: {
    readonly PENDING: "pending";
    readonly CONFIRMED: "confirmed";
    readonly SETTLED: "settled";
    readonly FAILED: "failed";
    readonly REFUNDED: "refunded";
};
