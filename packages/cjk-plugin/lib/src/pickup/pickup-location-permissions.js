"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickupLocationPermissionDefinitions = exports.SetGlobalPickupLocation = void 0;
const core_1 = require("@vendure/core");
exports.SetGlobalPickupLocation = new core_1.PermissionDefinition({
    name: 'SetGlobalPickupLocation',
    description: '允许创建/提升/编辑全局自提点（超管专用）',
});
exports.pickupLocationPermissionDefinitions = [exports.SetGlobalPickupLocation];
//# sourceMappingURL=pickup-location-permissions.js.map