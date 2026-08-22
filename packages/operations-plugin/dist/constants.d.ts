/**
 * Operations module permissions.
 * These are registered as PermissionDefinitions via delivery-plugin's deliveryPermissionDefinitions.
 * Defined here as string literals for type-safe reference in resolvers.
 */
export declare const OperationsPermissions: {
    readonly ViewDashboard: "ViewDashboard";
    readonly ManageBanner: "ManageBanner";
    readonly ManageRecommendation: "ManageRecommendation";
    readonly ManageNotice: "ManageNotice";
    readonly ManageFloor: "ManageFloor";
    readonly ManagePromotion: "ManagePromotion";
    readonly ManageContent: "ManageContent";
    readonly ManageFlashSale: "ManageFlashSale";
    readonly ManageGroupBuy: "ManageGroupBuy";
    readonly ManageCoupon: "ManageCoupon";
};
/**
 * CMS content types for ContentItem entity (single-table polymorphism discriminator).
 */
export declare enum ContentType {
    Banner = "Banner",
    Recommendation = "Recommendation",
    Notice = "Notice",
    Floor = "Floor",
    IconGrid = "IconGrid",
    CategoryNav = "CategoryNav"
}
/**
 * Low stock threshold for inventory metrics (hardcoded per spec Q1 decision).
 */
export declare const LOW_STOCK_THRESHOLD = 10;
/**
 * Role-permission mapping for operations module roles.
 * The 4 new permissions (ManageBanner/Recommendation/Notice/Floor) are appended to:
 * - operations-staff (primary role)
 * - manager (full access)
 * - super-admin (full access + SuperAdmin)
 *
 * Note: The actual ROLE_PERMISSIONS_MAP with all 7 roles lives in delivery-plugin/src/constants.ts.
 * This local copy is used only for reference and documentation.
 * RoleSyncService imports ROLE_PERMISSIONS_MAP from delivery-plugin.
 */
export declare const OPERATIONS_ROLE_PERMS: {
    'operations-staff': string[];
};
export declare const loggerCtx = "OperationsPlugin";
