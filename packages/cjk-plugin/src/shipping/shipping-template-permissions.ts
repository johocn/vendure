import { PermissionDefinition } from '@vendure/core';

export const ShippingTemplatePermissions = {
    ReadShippingTemplate: 'ShippingTemplateRead',
    CreateShippingTemplate: 'ShippingTemplateCreate',
    UpdateShippingTemplate: 'ShippingTemplateUpdate',
    DeleteShippingTemplate: 'ShippingTemplateDelete',
    CreateShippingMethodFromTemplate: 'ShippingMethodFromTemplate',
} as const;

export const shippingTemplatePermissionDefinitions: PermissionDefinition[] = Object.entries(
    ShippingTemplatePermissions,
).map(([key, name]) => new PermissionDefinition({ name, description: `Grants ${key} permission` }));
