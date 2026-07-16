"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMethodGuard = void 0;
exports.isAuthMethodEnabled = isAuthMethodEnabled;
// e:\code\vendure\packages\cjk-plugin\src\auth\auth-method-guard.ts
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
function isAuthMethodEnabled(ctx, method) {
    var _a, _b;
    const config = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.authConfig;
    if (!config)
        return true; // 向后兼容：未配置时所有策略启用
    return (config.enabledMethods || []).includes(method);
}
let AuthMethodGuard = class AuthMethodGuard {
    canActivate(context) {
        const parsed = (0, core_1.parseContext)(context);
        if (!parsed.isGraphQL)
            return true;
        const info = parsed.info;
        if (!info || info.fieldName !== 'authenticate')
            return true;
        // 用 internal_getRequestContext 取 RequestContext（Vendure AuthGuard 已写入）
        const ctx = (0, core_1.internal_getRequestContext)(parsed.req);
        if (!ctx)
            return true; // 无 ctx 降级放行
        // 仅拦截 shop 端，admin 端不受影响（防止管理员锁死）
        if (ctx.apiType !== 'shop')
            return true;
        const gqlCtx = graphql_1.GqlExecutionContext.create(context);
        const args = gqlCtx.getArgs();
        if (!(args === null || args === void 0 ? void 0 : args.input))
            return true;
        // AuthenticationInput 是 map: { native?: {...}, phone?: {...}, sso?: {...} }
        const method = Object.keys(args.input)[0];
        if (!method)
            return true;
        if (!isAuthMethodEnabled(ctx, method)) {
            throw new core_1.ForbiddenError();
        }
        return true;
    }
};
exports.AuthMethodGuard = AuthMethodGuard;
exports.AuthMethodGuard = AuthMethodGuard = __decorate([
    (0, common_1.Injectable)()
], AuthMethodGuard);
//# sourceMappingURL=auth-method-guard.js.map