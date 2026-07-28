import { PermissionDefinition } from '@vendure/core';
export declare const DeliveryPermissions: {
    readonly DeliverOrder: "DeliverOrder";
    readonly MarkDelivered: "MarkDelivered";
    readonly ReportException: "ReportException";
    readonly ViewAllDeliveries: "ViewAllDeliveries";
    readonly ReassignDelivery: "ReassignDelivery";
    readonly CreateOrder: "CreateOrder";
    readonly ViewOwnSales: "ViewOwnSales";
    readonly ManageCustomer: "ManageCustomer";
    readonly ViewSalesReport: "ViewSalesReport";
    readonly ViewStock: "ViewStock";
    readonly ManageStockMove: "ManageStockMove";
    readonly ManageStocktake: "ManageStocktake";
    readonly ManageStockIn: "ManageStockIn";
    readonly ManageStockOut: "ManageStockOut";
    readonly ViewAllOrders: "ViewAllOrders";
    readonly HandleAfterSales: "HandleAfterSales";
    readonly HandleException: "HandleException";
    readonly ManagePromotion: "ManagePromotion";
    readonly ManageContent: "ManageContent";
    readonly ViewDashboard: "ViewDashboard";
    readonly ManageProduct: "ManageProduct";
    readonly ManageUser: "ManageUser";
    readonly ViewFinance: "ViewFinance";
    readonly ManageMessage: "ManageMessage";
};
export declare const deliveryPermissionDefinitions: PermissionDefinition[];
export declare enum DeliveryStatus {
    Assigned = "assigned",
    InProgress = "in_progress",
    Delivered = "delivered",
    Exception = "exception"
}
export declare enum ExceptionType {
    Rejected = "rejected",
    WrongAddress = "wrong_address",
    NoRecipient = "no_recipient",
    Damaged = "damaged",
    Other = "other"
}
export declare const ROLE_PERMISSIONS_MAP: Record<string, string[]>;
export declare const MODULE_CONFIGS: {
    code: string;
    name: string;
    enabled: boolean;
    entryPath: string;
    icon: string;
    sort: number;
    perms: string[];
}[];
