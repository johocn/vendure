import { PermissionDefinition } from '@vendure/core';

export const paymentProfilePermission = new PermissionDefinition({
    name: 'PaymentProfile',
    description: 'Grants permissions for PaymentProfile operations',
});

export const paymentProfilePermissionDefinitions: PermissionDefinition[] = [
    paymentProfilePermission,
];