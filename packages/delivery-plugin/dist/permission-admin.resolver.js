"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const shared_constants_1 = require("@vendure/common/lib/shared-constants");
const constants_1 = require("./constants");
/**
 * @description
 * Admin API resolver：返回当前登录 administrator 的角色、权限及可见模块列表。
 *
 * 设计说明：
 * - 用 `@Allow(Permission.Authenticated)` 而非具体业务权限，任何已登录 administrator 均可调用，
 *   用于前端初始化时拉取自身权限快照。
 * - 使用 `findOneByUserId` 而非 `findOne`：`ctx.activeUserId` 是 User ID，不是 Administrator ID。
 * - 显式传入 relations `['user', 'user.roles']`：`findOneByUserId` 不像 `findOne` 那样默认加载。
 * - super-admin 识别三种信号：delivery-plugin 自定义 `super-admin` role、Vendure 内置
 *   `__super_admin_role__` role、或拥有 `Permission.SuperAdmin` 权限，任一命中即视为 super-admin，
 *   自动拥有全部 `DeliveryPermissions`。
 */
let PermissionAdminResolver = class PermissionAdminResolver {
    constructor(administratorService) {
        this.administratorService = administratorService;
    }
    async myPermissions(ctx) {
        var _a, _b, _c, _d;
        if (!ctx.activeUserId) {
            return { roles: [], permissions: [], visibleModules: [] };
        }
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId, [
            'user',
            'user.roles',
        ]);
        if (!admin || !admin.user) {
            return { roles: [], permissions: [], visibleModules: [] };
        }
        const roles = (_b = (_a = admin.user.roles) === null || _a === void 0 ? void 0 : _a.map(r => r.code)) !== null && _b !== void 0 ? _b : [];
        const permissions = new Set();
        for (const role of (_c = admin.user.roles) !== null && _c !== void 0 ? _c : []) {
            for (const perm of (_d = role.permissions) !== null && _d !== void 0 ? _d : []) {
                permissions.add(perm);
            }
        }
        // super-admin 角色自动拥有所有 DeliveryPermissions
        const isSuperAdmin = roles.includes('super-admin') ||
            roles.includes(shared_constants_1.SUPER_ADMIN_ROLE_CODE) ||
            permissions.has(core_1.Permission.SuperAdmin);
        if (isSuperAdmin) {
            Object.values(constants_1.DeliveryPermissions).forEach(p => permissions.add(p));
        }
        const permArray = Array.from(permissions);
        const visibleModules = constants_1.MODULE_CONFIGS.filter(m => m.enabled && (m.perms.length === 0 || m.perms.some(p => permArray.includes(p)))).map(m => ({
            code: m.code,
            name: m.name,
            enabled: m.enabled,
            entryPath: m.entryPath,
            icon: m.icon,
            sort: m.sort,
        }));
        return {
            roles,
            permissions: permArray,
            visibleModules,
        };
    }
};
exports.PermissionAdminResolver = PermissionAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PermissionAdminResolver.prototype, "myPermissions", null);
exports.PermissionAdminResolver = PermissionAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.AdministratorService])
], PermissionAdminResolver);
