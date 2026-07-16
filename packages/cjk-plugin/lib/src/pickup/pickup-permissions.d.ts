import { PermissionDefinition } from '@vendure/core';
export declare const PickupPermissions: {
    readonly ReadPickupLocation: "PickupLocationRead";
    readonly CreatePickupLocation: "PickupLocationCreate";
    readonly UpdatePickupLocation: "PickupLocationUpdate";
    readonly DeletePickupLocation: "PickupLocationDelete";
    readonly PromotePickupLocation: "PickupLocationPromote";
    readonly AssignPickupLocation: "PickupLocationAssign";
    readonly ReadEmployeeCustomer: "EmployeeCustomerRead";
    readonly CreateEmployeeCustomer: "EmployeeCustomerCreate";
    readonly UpdateEmployeeCustomer: "EmployeeCustomerUpdate";
    readonly DeleteEmployeeCustomer: "EmployeeCustomerDelete";
    readonly BindPickupLocation: "EmployeeCustomerBind";
    readonly VerifyEmployeeCustomer: "EmployeeCustomerVerify";
    readonly UpdateChannelPickupConfig: "UpdateChannelPickupConfig";
};
export declare const pickupPermissionDefinitions: PermissionDefinition[];
