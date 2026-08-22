// e:\code\vendure\packages\inventory-plugin\src\constants.ts
import { PermissionDefinition } from '@vendure/core';

// 权限名常量（引用 delivery-plugin 中已注册的权限，此处不重复注册 PermissionDefinition）
export const InventoryPermissions = {
  ViewStock: 'ViewStock',
  ManageStockIn: 'ManageStockIn',
  ManageStockOut: 'ManageStockOut',
  ManageStockMove: 'ManageStockMove',
  ManageStocktake: 'ManageStocktake',
  ManagePurchase: 'ManagePurchase',
  ManageSupplier: 'ManageSupplier',
} as const;

// 权限描述（供 PermissionDefinition 注册使用）
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  ViewStock: '库存查询',
  ManageStockIn: '入库单管理',
  ManageStockOut: '出库单管理',
  ManageStockMove: '调拨单管理',
  ManageStocktake: '盘点单管理',
  ManagePurchase: '采购单管理',
  ManageSupplier: '供应商管理',
};

// PermissionDefinition 实例数组，注册到 config.authOptions.customPermissions（与 delivery-plugin 同源权限同名，可安全重复注册）
export const inventoryPermissionDefinitions: PermissionDefinition[] = Object.entries(
  InventoryPermissions,
).map(
  ([key, name]) =>
    new PermissionDefinition({
      name,
      description: PERMISSION_DESCRIPTIONS[key] ?? `Grants ${key} permission`,
    }),
);

// Role 与 Permission 绑定表（增量同步：已存在的角色仅补绑缺失权限）
export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
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
    'ManagePurchase',
    'ManageSupplier',
  ],
  'super-admin': [
    'Authenticated',
    'ViewStock',
    'ManageStockIn',
    'ManageStockOut',
    'ManageStockMove',
    'ManageStocktake',
    'ManagePurchase',
    'ManageSupplier',
    'SuperAdmin',
  ],
};

// ===== 状态枚举 =====
export enum StockInState {
  Pending = 'Pending',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum StockOutState {
  Pending = 'Pending',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum StockMoveState {
  Pending = 'Pending',
  InTransit = 'InTransit',
  Received = 'Received',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum StocktakeState {
  Pending = 'Pending',
  Counting = 'Counting',
  Reconciling = 'Reconciling',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum PurchaseOrderState {
  Draft = 'Draft',
  Ordered = 'Ordered',
  PartiallyReceived = 'PartiallyReceived',
  Received = 'Received',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

// ===== 状态转换表 =====
export const STOCK_IN_TRANSITIONS: Record<StockInState, StockInState[]> = {
  [StockInState.Pending]: [StockInState.Completed, StockInState.Cancelled],
  [StockInState.Completed]: [],
  [StockInState.Cancelled]: [],
};

export const STOCK_OUT_TRANSITIONS: Record<StockOutState, StockOutState[]> = {
  [StockOutState.Pending]: [StockOutState.Completed, StockOutState.Cancelled],
  [StockOutState.Completed]: [],
  [StockOutState.Cancelled]: [],
};

export const STOCK_MOVE_TRANSITIONS: Record<StockMoveState, StockMoveState[]> = {
  [StockMoveState.Pending]: [StockMoveState.InTransit, StockMoveState.Cancelled],
  [StockMoveState.InTransit]: [StockMoveState.Received, StockMoveState.Cancelled],
  [StockMoveState.Received]: [StockMoveState.Completed],
  [StockMoveState.Completed]: [],
  [StockMoveState.Cancelled]: [],
};

export const STOCKTAKE_TRANSITIONS: Record<StocktakeState, StocktakeState[]> = {
  [StocktakeState.Pending]: [StocktakeState.Counting, StocktakeState.Cancelled],
  [StocktakeState.Counting]: [StocktakeState.Reconciling, StocktakeState.Cancelled],
  [StocktakeState.Reconciling]: [StocktakeState.Completed],
  [StocktakeState.Completed]: [],
  [StocktakeState.Cancelled]: [],
};

export const PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderState, PurchaseOrderState[]> = {
  [PurchaseOrderState.Draft]: [PurchaseOrderState.Ordered, PurchaseOrderState.Cancelled],
  [PurchaseOrderState.Ordered]: [
    PurchaseOrderState.PartiallyReceived,
    PurchaseOrderState.Received,
    PurchaseOrderState.Cancelled,
  ],
  // 分批收货：PartiallyReceived 未收满可继续收货（保持 PartiallyReceived），全部收满变 Received
  [PurchaseOrderState.PartiallyReceived]: [
    PurchaseOrderState.PartiallyReceived,
    PurchaseOrderState.Received,
  ],
  [PurchaseOrderState.Received]: [PurchaseOrderState.Completed],
  [PurchaseOrderState.Completed]: [],
  [PurchaseOrderState.Cancelled]: [],
};
