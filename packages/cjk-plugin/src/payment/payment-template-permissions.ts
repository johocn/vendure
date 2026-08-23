import { PermissionDefinition } from '@vendure/core';

export const PaymentTemplatePermissions = {
    ReadPaymentTemplate: 'PaymentTemplateRead',
    CreatePaymentTemplate: 'PaymentTemplateCreate',
    UpdatePaymentTemplate: 'PaymentTemplateUpdate',
    DeletePaymentTemplate: 'PaymentTemplateDelete',
    CreatePaymentMethodFromTemplate: 'PaymentMethodFromTemplate',
} as const;

export const paymentTemplatePermissionDefinitions: PermissionDefinition[] = Object.entries(
    PaymentTemplatePermissions,
).map(([key, name]) => new PermissionDefinition({ name, description: `Grants ${key} permission` }));