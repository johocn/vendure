"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippingTemplatePermissionDefinitions = exports.ShippingTemplatePermissions = void 0;
const core_1 = require("@vendure/core");
exports.ShippingTemplatePermissions = {
    ReadShippingTemplate: 'ShippingTemplateRead',
    CreateShippingTemplate: 'ShippingTemplateCreate',
    UpdateShippingTemplate: 'ShippingTemplateUpdate',
    DeleteShippingTemplate: 'ShippingTemplateDelete',
    CreateShippingMethodFromTemplate: 'ShippingMethodFromTemplate',
};
exports.shippingTemplatePermissionDefinitions = Object.entries(exports.ShippingTemplatePermissions).map(([key, name]) => new core_1.PermissionDefinition({ name, description: `Grants ${key} permission` }));
//# sourceMappingURL=shipping-template-permissions.js.map