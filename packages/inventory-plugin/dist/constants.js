"use strict";
// e:\code\vendure\packages\inventory-plugin\src\constants.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCKTAKE_TRANSITIONS = exports.STOCK_MOVE_TRANSITIONS = exports.STOCK_OUT_TRANSITIONS = exports.STOCK_IN_TRANSITIONS = exports.StocktakeState = exports.StockMoveState = exports.StockOutState = exports.StockInState = exports.ROLE_PERMISSIONS_MAP = exports.InventoryPermissions = void 0;
// 权限名常量（引用 delivery-plugin 中已注册的权限，此处不重复注册 PermissionDefinition）
exports.InventoryPermissions = {
    ViewStock: 'ViewStock',
    ManageStockIn: 'ManageStockIn',
    ManageStockOut: 'ManageStockOut',
    ManageStockMove: 'ManageStockMove',
    ManageStocktake: 'ManageStocktake',
};
// Role 与 Permission 绑定表（增量同步：已存在的角色仅补绑缺失权限）
exports.ROLE_PERMISSIONS_MAP = {
    'inventory-staff': [
        'Authenticated',
        'ViewStock',
        'ManageStockIn',
        'ManageStockOut',
        'ManageStockMove',
        'ManageStocktake',
    ],
    'manager': [
        'Authenticated',
        'ViewStock',
        'ManageStockIn',
        'ManageStockOut',
        'ManageStockMove',
        'ManageStocktake',
    ],
    'super-admin': [
        'Authenticated',
        'ViewStock',
        'ManageStockIn',
        'ManageStockOut',
        'ManageStockMove',
        'ManageStocktake',
        'SuperAdmin',
    ],
};
// ===== 状态枚举 =====
var StockInState;
(function (StockInState) {
    StockInState["Pending"] = "Pending";
    StockInState["Completed"] = "Completed";
    StockInState["Cancelled"] = "Cancelled";
})(StockInState || (exports.StockInState = StockInState = {}));
var StockOutState;
(function (StockOutState) {
    StockOutState["Pending"] = "Pending";
    StockOutState["Completed"] = "Completed";
    StockOutState["Cancelled"] = "Cancelled";
})(StockOutState || (exports.StockOutState = StockOutState = {}));
var StockMoveState;
(function (StockMoveState) {
    StockMoveState["Pending"] = "Pending";
    StockMoveState["InTransit"] = "InTransit";
    StockMoveState["Received"] = "Received";
    StockMoveState["Completed"] = "Completed";
    StockMoveState["Cancelled"] = "Cancelled";
})(StockMoveState || (exports.StockMoveState = StockMoveState = {}));
var StocktakeState;
(function (StocktakeState) {
    StocktakeState["Pending"] = "Pending";
    StocktakeState["Counting"] = "Counting";
    StocktakeState["Reconciling"] = "Reconciling";
    StocktakeState["Completed"] = "Completed";
    StocktakeState["Cancelled"] = "Cancelled";
})(StocktakeState || (exports.StocktakeState = StocktakeState = {}));
// ===== 状态转换表 =====
exports.STOCK_IN_TRANSITIONS = {
    [StockInState.Pending]: [StockInState.Completed, StockInState.Cancelled],
    [StockInState.Completed]: [],
    [StockInState.Cancelled]: [],
};
exports.STOCK_OUT_TRANSITIONS = {
    [StockOutState.Pending]: [StockOutState.Completed, StockOutState.Cancelled],
    [StockOutState.Completed]: [],
    [StockOutState.Cancelled]: [],
};
exports.STOCK_MOVE_TRANSITIONS = {
    [StockMoveState.Pending]: [StockMoveState.InTransit, StockMoveState.Cancelled],
    [StockMoveState.InTransit]: [StockMoveState.Received, StockMoveState.Cancelled],
    [StockMoveState.Received]: [StockMoveState.Completed],
    [StockMoveState.Completed]: [],
    [StockMoveState.Cancelled]: [],
};
exports.STOCKTAKE_TRANSITIONS = {
    [StocktakeState.Pending]: [StocktakeState.Counting, StocktakeState.Cancelled],
    [StocktakeState.Counting]: [StocktakeState.Reconciling, StocktakeState.Cancelled],
    [StocktakeState.Reconciling]: [StocktakeState.Completed],
    [StocktakeState.Completed]: [],
    [StocktakeState.Cancelled]: [],
};
