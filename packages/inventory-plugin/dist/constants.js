"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCKTAKE_TRANSITIONS = exports.STOCK_MOVE_TRANSITIONS = exports.STOCK_OUT_TRANSITIONS = exports.STOCK_IN_TRANSITIONS = exports.StocktakeState = exports.StockMoveState = exports.StockOutState = exports.StockInState = exports.ROLE_PERMISSIONS_MAP = exports.inventoryPermissionDefinitions = exports.InventoryPermissions = void 0;
// e:\code\vendure\packages\inventory-plugin\src\constants.ts
const core_1 = require("@vendure/core");
// 权限名常量（引用 delivery-plugin 中已注册的权限，此处不重复注册 PermissionDefinition）
exports.InventoryPermissions = {
    ViewStock: 'ViewStock',
    ManageStockIn: 'ManageStockIn',
    ManageStockOut: 'ManageStockOut',
    ManageStockMove: 'ManageStockMove',
    ManageStocktake: 'ManageStocktake',
};
// 权限描述（供 PermissionDefinition 注册使用）
const PERMISSION_DESCRIPTIONS = {
    ViewStock: '库存查询',
    ManageStockIn: '入库单管理',
    ManageStockOut: '出库单管理',
    ManageStockMove: '调拨单管理',
    ManageStocktake: '盘点单管理',
};
// PermissionDefinition 实例数组，注册到 config.authOptions.customPermissions（与 delivery-plugin 同源权限同名，可安全重复注册）
exports.inventoryPermissionDefinitions = Object.entries(exports.InventoryPermissions).map(([key, name]) => {
    var _a;
    return new core_1.PermissionDefinition({
        name,
        description: (_a = PERMISSION_DESCRIPTIONS[key]) !== null && _a !== void 0 ? _a : `Grants ${key} permission`,
    });
});
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
