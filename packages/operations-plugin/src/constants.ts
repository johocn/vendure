// e:\code\vendure\packages\operations-plugin\src\constants.ts

/**
 * Operations module permissions.
 * These are registered as PermissionDefinitions via delivery-plugin's deliveryPermissionDefinitions.
 * Defined here as string literals for type-safe reference in resolvers.
 */
export const OperationsPermissions = {
    ViewDashboard: 'ViewDashboard',
    ManageBanner: 'ManageBanner',
    ManageRecommendation: 'ManageRecommendation',
    ManageNotice: 'ManageNotice',
    ManageFloor: 'ManageFloor',
    ManagePromotion: 'ManagePromotion',
    ManageContent: 'ManageContent',
} as const;

/**
 * CMS content types for ContentItem entity (single-table polymorphism discriminator).
 */
export enum ContentType {
    Banner = 'Banner',
    Recommendation = 'Recommendation',
    Notice = 'Notice',
    Floor = 'Floor',
}

/**
 * Low stock threshold for inventory metrics (hardcoded per spec Q1 decision).
 */
export const LOW_STOCK_THRESHOLD = 10;

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
export const OPERATIONS_ROLE_PERMS = {
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

export const loggerCtx = 'OperationsPlugin';
