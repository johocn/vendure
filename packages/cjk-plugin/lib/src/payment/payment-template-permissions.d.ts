import { PermissionDefinition } from '@vendure/core';
export declare const PaymentTemplatePermissions: {
    readonly ReadPaymentTemplate: "PaymentTemplateRead";
    readonly CreatePaymentTemplate: "PaymentTemplateCreate";
    readonly UpdatePaymentTemplate: "PaymentTemplateUpdate";
    readonly DeletePaymentTemplate: "PaymentTemplateDelete";
    readonly CreatePaymentMethodFromTemplate: "PaymentMethodFromTemplate";
};
export declare const paymentTemplatePermissionDefinitions: PermissionDefinition[];
