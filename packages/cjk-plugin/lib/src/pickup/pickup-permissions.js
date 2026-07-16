"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickupPermissionDefinitions = exports.PickupPermissions = void 0;
const core_1 = require("@vendure/core");
exports.PickupPermissions = {
    ReadPickupLocation: 'PickupLocationRead',
    CreatePickupLocation: 'PickupLocationCreate',
    UpdatePickupLocation: 'PickupLocationUpdate',
    DeletePickupLocation: 'PickupLocationDelete',
    PromotePickupLocation: 'PickupLocationPromote',
    AssignPickupLocation: 'PickupLocationAssign',
    ReadEmployeeCustomer: 'EmployeeCustomerRead',
    CreateEmployeeCustomer: 'EmployeeCustomerCreate',
    UpdateEmployeeCustomer: 'EmployeeCustomerUpdate',
    DeleteEmployeeCustomer: 'EmployeeCustomerDelete',
    BindPickupLocation: 'EmployeeCustomerBind',
    VerifyEmployeeCustomer: 'EmployeeCustomerVerify',
    UpdateChannelPickupConfig: 'UpdateChannelPickupConfig',
};
// PermissionDefinition 实例数组，用于注册到 config.authOptions.customPermissions
exports.pickupPermissionDefinitions = Object.entries(exports.PickupPermissions).map(([key, name]) => new core_1.PermissionDefinition({ name, description: `Grants ${key} permission` }));
//# sourceMappingURL=pickup-permissions.js.map