import { PermissionDefinition } from '@vendure/core';
export declare const SalesPermissions: {
    readonly CreateOrder: "CreateOrder";
    readonly ViewOwnSales: "ViewOwnSales";
    readonly ViewAllSales: "ViewAllSales";
    readonly ManageCustomer: "ManageCustomer";
    readonly ViewSalesReport: "ViewSalesReport";
    readonly ModifyOrderPrice: "ModifyOrderPrice";
};
export declare const salesPermissionDefinitions: PermissionDefinition[];
export declare enum SalesChannel {
    Store = "store",
    Telesales = "telesales",
    B2b = "b2b"
}
export declare enum CustomerType {
    Individual = "individual",
    Enterprise = "enterprise"
}
export declare const ROLE_PERMISSIONS_MAP: Record<string, string[]>;
