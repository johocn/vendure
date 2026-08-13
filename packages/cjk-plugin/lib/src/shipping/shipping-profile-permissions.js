"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippingProfilePermissionDefinitions = exports.shippingProfilePermission = void 0;
const core_1 = require("@vendure/core");
exports.shippingProfilePermission = new core_1.PermissionDefinition({
    name: 'ShippingProfile',
    description: 'Grants permissions for ShippingProfile operations',
});
exports.shippingProfilePermissionDefinitions = [
    exports.shippingProfilePermission,
];
//# sourceMappingURL=shipping-profile-permissions.js.map