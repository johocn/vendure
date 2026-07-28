// e:\code\vendure\packages\inventory-plugin\src\constants.ts

// 权限名常量（引用 delivery-plugin 中已注册的权限，此处不重复注册 PermissionDefinition）
export const InventoryPermissions = {
  ViewStock: 'ViewStock',
  ManageStockIn: 'ManageStockIn',
  ManageStockOut: 'ManageStockOut',
  ManageStockMove: 'ManageStockMove',
  ManageStocktake: 'ManageStocktake',
} as const;

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
