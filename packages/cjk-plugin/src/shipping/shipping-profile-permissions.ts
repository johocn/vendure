import { PermissionDefinition } from '@vendure/core';

export const shippingProfilePermission = new PermissionDefinition({
    name: 'ShippingProfile',
    description: 'Grants permissions for ShippingProfile operations',
});

export const shippingProfilePermissionDefinitions: PermissionDefinition[] = [
    shippingProfilePermission,
];