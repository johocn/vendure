"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stocktakePermissionDefinitions = exports.StocktakePostPermission = exports.StocktakeCountPermission = void 0;
const core_1 = require("@vendure/core");
/** 能盘：建任务 / 拆盘次 / 认领 / 录入 / 提交 */
exports.StocktakeCountPermission = new core_1.PermissionDefinition({
    name: 'StocktakeCount',
    description: '多人协同盘库：建任务、拆盘次、认领、录入、提交',
});
/** 能过账：差异复核 + 一键过账（与「能盘」刻意分开，规格 §9） */
exports.StocktakePostPermission = new core_1.PermissionDefinition({
    name: 'StocktakePost',
    description: '多人协同盘库：差异复核与过账',
});
exports.stocktakePermissionDefinitions = [exports.StocktakeCountPermission, exports.StocktakePostPermission];
//# sourceMappingURL=stocktake-permissions.js.map