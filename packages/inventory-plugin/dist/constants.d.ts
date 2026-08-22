import { PermissionDefinition } from '@vendure/core';
export declare const InventoryPermissions: {
    readonly ViewStock: "ViewStock";
    readonly ManageStockIn: "ManageStockIn";
    readonly ManageStockOut: "ManageStockOut";
    readonly ManageStockMove: "ManageStockMove";
    readonly ManageStocktake: "ManageStocktake";
    readonly ManagePurchase: "ManagePurchase";
    readonly ManageSupplier: "ManageSupplier";
};
export declare const inventoryPermissionDefinitions: PermissionDefinition[];
export declare const ROLE_PERMISSIONS_MAP: Record<string, string[]>;
export declare enum StockInState {
    Pending = "Pending",
    Completed = "Completed",
    Cancelled = "Cancelled"
}
export declare enum StockOutState {
    Pending = "Pending",
    Completed = "Completed",
    Cancelled = "Cancelled"
}
export declare enum StockMoveState {
    Pending = "Pending",
    InTransit = "InTransit",
    Received = "Received",
    Completed = "Completed",
    Cancelled = "Cancelled"
}
export declare enum StocktakeState {
    Pending = "Pending",
    Counting = "Counting",
    Reconciling = "Reconciling",
    Completed = "Completed",
    Cancelled = "Cancelled"
}
export declare enum PurchaseOrderState {
    Draft = "Draft",
    Ordered = "Ordered",
    PartiallyReceived = "PartiallyReceived",
    Received = "Received",
    Completed = "Completed",
    Cancelled = "Cancelled"
}
export declare const STOCK_IN_TRANSITIONS: Record<StockInState, StockInState[]>;
export declare const STOCK_OUT_TRANSITIONS: Record<StockOutState, StockOutState[]>;
export declare const STOCK_MOVE_TRANSITIONS: Record<StockMoveState, StockMoveState[]>;
export declare const STOCKTAKE_TRANSITIONS: Record<StocktakeState, StocktakeState[]>;
export declare const PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderState, PurchaseOrderState[]>;
