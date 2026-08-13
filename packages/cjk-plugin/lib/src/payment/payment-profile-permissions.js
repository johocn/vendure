"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentProfilePermissionDefinitions = exports.paymentProfilePermission = void 0;
const core_1 = require("@vendure/core");
exports.paymentProfilePermission = new core_1.PermissionDefinition({
    name: 'PaymentProfile',
    description: 'Grants permissions for PaymentProfile operations',
});
exports.paymentProfilePermissionDefinitions = [
    exports.paymentProfilePermission,
];
//# sourceMappingURL=payment-profile-permissions.js.map