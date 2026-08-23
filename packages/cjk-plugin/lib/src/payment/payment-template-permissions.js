"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentTemplatePermissionDefinitions = exports.PaymentTemplatePermissions = void 0;
const core_1 = require("@vendure/core");
exports.PaymentTemplatePermissions = {
    ReadPaymentTemplate: 'PaymentTemplateRead',
    CreatePaymentTemplate: 'PaymentTemplateCreate',
    UpdatePaymentTemplate: 'PaymentTemplateUpdate',
    DeletePaymentTemplate: 'PaymentTemplateDelete',
    CreatePaymentMethodFromTemplate: 'PaymentMethodFromTemplate',
};
exports.paymentTemplatePermissionDefinitions = Object.entries(exports.PaymentTemplatePermissions).map(([key, name]) => new core_1.PermissionDefinition({ name, description: `Grants ${key} permission` }));
//# sourceMappingURL=payment-template-permissions.js.map