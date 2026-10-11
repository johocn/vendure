"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiyDelete = exports.DiyUpdate = exports.DiyCreate = exports.DiyRead = void 0;
const core_1 = require("@vendure/core");
exports.DiyRead = new core_1.PermissionDefinition({
    name: 'DiyRead',
    description: 'Allows viewing DIY categories, materials, templates and plans',
});
exports.DiyCreate = new core_1.PermissionDefinition({
    name: 'DiyCreate',
    description: 'Allows creating DIY categories, materials and templates',
});
exports.DiyUpdate = new core_1.PermissionDefinition({
    name: 'DiyUpdate',
    description: 'Allows updating DIY categories, materials, templates and importing materials',
});
exports.DiyDelete = new core_1.PermissionDefinition({
    name: 'DiyDelete',
    description: 'Allows deleting DIY categories, materials and templates',
});
//# sourceMappingURL=permissions.js.map