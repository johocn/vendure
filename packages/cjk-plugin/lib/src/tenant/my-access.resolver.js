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
exports.MyAccessResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const tenant_member_entity_1 = require("./tenant-member.entity");
/**
 * 登录后返回当前后台用户的租户访问信息：
 * - channels：每个有权限的租户的启停状态（enabled）与该用户在该租户的人员启停（memberEnabled）
 * - permissions：当前用户在所有角色中累积的业务权限码（供前端菜单渲染）
 */
let MyAccessResolver = class MyAccessResolver {
    constructor(channelService, connection) {
        this.channelService = channelService;
        this.connection = connection;
    }
    async myTenantAccess(ctx) {
        var _a, _b;
        const user = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user;
        const isSuperAdmin = ctx.userHasPermissions([core_1.Permission.SuperAdmin]);
        // 当前用户可访问的 channel（Vendure 依据其角色）
        const me = await this.channelService.findAll(ctx, { take: 1000 });
        let channels = me.items;
        if (!isSuperAdmin) {
            // 非超管：过滤到用户角色限定的 channel
            const userRoles = (user === null || user === void 0 ? void 0 : user.roles) || [];
            const roleChannelIds = new Set();
            for (const r of userRoles) {
                for (const c of r.channels || [])
                    roleChannelIds.add(String(c.id));
            }
            channels = channels.filter((c) => roleChannelIds.has(String(c.id)));
        }
        // 查询每个 channel 的启停 + 当前用户在其中的 TenantMember 启停
        const memberRepo = this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember);
        const memberRows = await memberRepo.find({ where: { administratorId: String((_b = user === null || user === void 0 ? void 0 : user.id) !== null && _b !== void 0 ? _b : '') } });
        const memberByChannel = new Map();
        for (const m of memberRows)
            memberByChannel.set(String(m.channelId), m);
        const result = channels.map((c) => {
            var _a;
            const ccf = c.customFields || {};
            const member = memberByChannel.get(String(c.id));
            return {
                id: String(c.id),
                code: c.code,
                token: c.token,
                name: cccName(c, ccf),
                enabled: ccf.enabled !== false,
                tenantNo: (_a = ccf.tenantNo) !== null && _a !== void 0 ? _a : null,
                isOfficial: ccf.isOfficial === true,
                memberEnabled: isSuperAdmin ? true : (member ? member.enabled : true),
            };
        });
        // 权限码集合（前端菜单渲染用）
        const permissions = new Set();
        if (isSuperAdmin) {
            permissions.add(core_1.Permission.SuperAdmin);
        }
        for (const r of (user === null || user === void 0 ? void 0 : user.roles) || []) {
            for (const p of r.permissions || [])
                permissions.add(p);
        }
        return {
            isSuperAdmin,
            channels: result,
            permissions: [...permissions],
        };
    }
};
exports.MyAccessResolver = MyAccessResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MyAccessResolver.prototype, "myTenantAccess", null);
exports.MyAccessResolver = MyAccessResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(core_1.ChannelService)),
    __param(1, (0, common_1.Inject)(core_1.TransactionalConnection)),
    __metadata("design:paramtypes", [core_1.ChannelService,
        core_1.TransactionalConnection])
], MyAccessResolver);
function cccName(c, ccf) {
    return ccf.shopName || c.code;
}
//# sourceMappingURL=my-access.resolver.js.map