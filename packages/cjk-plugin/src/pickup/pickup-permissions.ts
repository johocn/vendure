import { PermissionDefinition } from '@vendure/core';

export const PickupPermissions = {
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
} as const;

// PermissionDefinition 实例数组，用于注册到 config.authOptions.customPermissions
export const pickupPermissionDefinitions: PermissionDefinition[] = Object.entries(PickupPermissions).map(
    ([key, name]) => new PermissionDefinition({ name, description: `Grants ${key} permission` }),
);
