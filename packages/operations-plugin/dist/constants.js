"use strict";
// e:\code\vendure\packages\operations-plugin\src\constants.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerCtx = exports.OPERATIONS_ROLE_PERMS = exports.LOW_STOCK_THRESHOLD = exports.ContentType = exports.OperationsPermissions = void 0;
/**
 * Operations module permissions.
 * These are registered as PermissionDefinitions via delivery-plugin's deliveryPermissionDefinitions.
 * Defined here as string literals for type-safe reference in resolvers.
 */
exports.OperationsPermissions = {
    ViewDashboard: 'ViewDashboard',
    ManageBanner: 'ManageBanner',
    ManageRecommendation: 'ManageRecommendation',
    ManageNotice: 'ManageNotice',
    ManageFloor: 'ManageFloor',
    ManagePromotion: 'ManagePromotion',
    ManageContent: 'ManageContent',
};
/**
 * CMS content types for ContentItem entity (single-table polymorphism discriminator).
 */
var ContentType;
(function (ContentType) {
    ContentType["Banner"] = "Banner";
    ContentType["Recommendation"] = "Recommendation";
    ContentType["Notice"] = "Notice";
    ContentType["Floor"] = "Floor";
})(ContentType || (exports.ContentType = ContentType = {}));
/**
 * Low stock threshold for inventory metrics (hardcoded per spec Q1 decision).
 */
exports.LOW_STOCK_THRESHOLD = 10;
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
exports.OPERATIONS_ROLE_PERMS = {
    'operations-staff': [
        'Authenticated',
        'ViewDashboard',
        'ManageBanner',
        'ManageRecommendation',
        'ManageNotice',
        'ManageFloor',
        'ManagePromotion',
        'ManageContent',
    ],
};
exports.loggerCtx = 'OperationsPlugin';
