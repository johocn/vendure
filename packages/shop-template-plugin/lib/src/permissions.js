"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopTemplatesDelete = exports.shopTemplatesUpdate = exports.shopTemplatesCreate = exports.shopTemplatesRead = void 0;
const core_1 = require("@vendure/core");
exports.shopTemplatesRead = new core_1.PermissionDefinition({
    name: 'ShopTemplatesRead',
    description: 'Allows viewing the shop template library and global config',
});
exports.shopTemplatesCreate = new core_1.PermissionDefinition({
    name: 'ShopTemplatesCreate',
    description: 'Allows creating and copying shop templates',
});
exports.shopTemplatesUpdate = new core_1.PermissionDefinition({
    name: 'ShopTemplatesUpdate',
    description: 'Allows updating shop templates and global config',
});
exports.shopTemplatesDelete = new core_1.PermissionDefinition({
    name: 'ShopTemplatesDelete',
    description: 'Allows deleting shop templates',
});
//# sourceMappingURL=permissions.js.map