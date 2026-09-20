"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGGREGATE_PAY_STATUS = exports.ORDER_TYPE = exports.POS_SESSION_STATE = exports.posSessionPermission = exports.posTerminalPermission = exports.POS_PERMISSIONS = void 0;
const core_1 = require("@vendure/core");
exports.POS_PERMISSIONS = {
    TERMINAL_READ: 'PosTerminal.Read',
    TERMINAL_CREATE: 'PosTerminal.Create',
    TERMINAL_UPDATE: 'PosTerminal.Update',
    TERMINAL_DELETE: 'PosTerminal.Delete',
    SESSION_READ: 'PosSession.Read',
    SESSION_OPEN: 'PosSession.Open',
    SESSION_CLOSE: 'PosSession.Close',
    SESSION_APPROVE: 'PosSession.Approve',
    ORDER_ADD_ITEM: 'PosOrder.AddItem',
    ORDER_CHECKOUT: 'PosOrder.Checkout',
    ORDER_REFUND: 'Order.Refund.Create',
    PRODUCT_READ: 'PosProduct.Read',
    MEMBER_READ: 'PosMember.Read',
    ORDER_SYNC: 'PosOrder.Sync',
};
/**
 * PosTerminal CRUD 权限定义（用于 @Allow 装饰器与 authOptions.customPermissions 注册）。
 * 生成 CreatePosTerminal / ReadPosTerminal / UpdatePosTerminal / DeletePosTerminal 四个权限。
 */
exports.posTerminalPermission = new core_1.CrudPermissionDefinition('PosTerminal');
/**
 * PosSession CRUD 权限定义。Create/Update 对应开班/关班动作。
 */
exports.posSessionPermission = new core_1.CrudPermissionDefinition('PosSession');
exports.POS_SESSION_STATE = {
    OPEN: 'open',
    CLOSED: 'closed',
};
exports.ORDER_TYPE = {
    SALE: 'sale',
    REFUND: 'refund',
    HOLD: 'hold',
};
exports.AGGREGATE_PAY_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    SETTLED: 'settled',
    FAILED: 'failed',
    REFUNDED: 'refunded',
};
//# sourceMappingURL=constants.js.map