import { CrudPermissionDefinition } from '@vendure/core';
export declare const SYNC_STATUS: {
    readonly PENDING: "pending";
    readonly SYNCING: "syncing";
    readonly SUCCESS: "success";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
    readonly NEEDS_MANUAL: "needs_manual";
};
export declare const SYNC_TYPE: {
    readonly ORDER: "order";
    readonly PAYMENT: "payment";
    readonly SESSION: "session";
};
export declare const offlineSyncPermission: CrudPermissionDefinition;
