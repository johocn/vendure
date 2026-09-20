"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offlineSyncPermission = exports.SYNC_TYPE = exports.SYNC_STATUS = void 0;
const core_1 = require("@vendure/core");
exports.SYNC_STATUS = {
    PENDING: 'pending',
    SYNCING: 'syncing',
    SUCCESS: 'success',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    NEEDS_MANUAL: 'needs_manual',
};
exports.SYNC_TYPE = {
    ORDER: 'order',
    PAYMENT: 'payment',
    SESSION: 'session',
};
exports.offlineSyncPermission = new core_1.CrudPermissionDefinition('OfflineSync');
//# sourceMappingURL=constants.js.map