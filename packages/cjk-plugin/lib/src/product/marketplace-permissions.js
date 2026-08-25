"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformProductReviewPermission = void 0;
const core_1 = require("@vendure/core");
/** 平台商品审批权限：仅超管/平台运营可调用审批相关接口 */
exports.platformProductReviewPermission = new core_1.PermissionDefinition({
    name: 'PlatformProductReview',
    description: '平台商品上架审批',
});
//# sourceMappingURL=marketplace-permissions.js.map