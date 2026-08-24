"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantPermissionDefinitions = exports.verifyOrderPermission = exports.tenantMemberManagePermission = exports.tenantRoleManagePermission = exports.tenantManagePermission = exports.VerifyOrderPermission = exports.TenantMemberManagePermission = exports.TenantRoleManagePermission = exports.TenantManagePermission = void 0;
const core_1 = require("@vendure/core");
/** 超管租户管理（仅 SuperAdmin 角色持有） */
exports.TenantManagePermission = 'TenantManage';
/** 租户级角色管理（租户管理员角色持有） */
exports.TenantRoleManagePermission = 'TenantRoleManage';
/** 租户级人员管理（租户管理员角色持有） */
exports.TenantMemberManagePermission = 'TenantMemberManage';
/** 订单核销（预留，本轮仅定义不实现） */
exports.VerifyOrderPermission = 'VerifyOrder';
exports.tenantManagePermission = new core_1.PermissionDefinition({
    name: exports.TenantManagePermission,
    description: '管理租户（超管）',
});
exports.tenantRoleManagePermission = new core_1.PermissionDefinition({
    name: exports.TenantRoleManagePermission,
    description: '管理租户角色',
});
exports.tenantMemberManagePermission = new core_1.PermissionDefinition({
    name: exports.TenantMemberManagePermission,
    description: '管理租户内部人员',
});
exports.verifyOrderPermission = new core_1.PermissionDefinition({
    name: exports.VerifyOrderPermission,
    description: '核销订单（预留）',
});
exports.tenantPermissionDefinitions = [
    exports.tenantManagePermission,
    exports.tenantRoleManagePermission,
    exports.tenantMemberManagePermission,
    exports.verifyOrderPermission,
];
//# sourceMappingURL=tenant-permissions.js.map