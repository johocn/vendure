"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productBundlePermission = exports.loggerCtx = void 0;
const core_1 = require("@vendure/core");
exports.loggerCtx = 'ProductBundlesPlugin';
exports.productBundlePermission = new core_1.CrudPermissionDefinition('ProductBundle');
//# sourceMappingURL=constants.js.map