"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DouyinAuthenticationStrategy = void 0;
const graphql_tag_1 = require("graphql-tag");
const core_1 = require("@vendure/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const douyin_auth_service_1 = require("./douyin-auth.service");
class DouyinAuthenticationStrategy {
    constructor(options) {
        this.options = options;
        this.name = 'douyin';
    }
    init(injector) {
        this.userService = injector.get(core_1.UserService);
        this.douyinAuthService = new douyin_auth_service_1.DouyinAuthService(this.options);
    }
    defineInputType() {
        return (0, graphql_tag_1.gql) `
            input DouyinAuthInput {
                code: String!
                type: String!
            }
        `;
    }
    async authenticate(ctx, data) {
        // 租户级登录方式开关检查（先于 devBypass）
        if (!(0, cjk_plugin_1.isAuthMethodEnabled)(ctx, 'douyin')) {
            throw new core_1.ForbiddenError();
        }
        // devBypass 分支（保持原样，不使用 override）
        if (this.options.devBypass) {
            const testOpenid = this.options.devBypassOpenid || 'dev_test_openid';
            const identifier = `douyin_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }
        // 租户凭证覆盖（已解密；无覆盖则回退 this.options）
        const override = (0, cjk_plugin_1.getAuthOverride)(ctx, 'douyin');
        const appId = (override === null || override === void 0 ? void 0 : override.appId) || this.options.appId;
        const appSecret = (override === null || override === void 0 ? void 0 : override.appSecret) || this.options.appSecret;
        const miniProgramAppId = (override === null || override === void 0 ? void 0 : override.miniProgramAppId) || this.options.miniProgramAppId;
        const miniProgramAppSecret = (override === null || override === void 0 ? void 0 : override.miniProgramAppSecret) || this.options.miniProgramAppSecret;
        try {
            const openid = await this.douyinAuthService.getOpenidByCode(data.code, appId, appSecret, miniProgramAppId, miniProgramAppSecret);
            const identifier = `douyin_${data.type}_${openid}`;
            return this.findOrCreateUser(ctx, identifier);
        }
        catch (e) {
            return false;
        }
    }
    async findOrCreateUser(ctx, identifier) {
        const existing = await this.userService.getUserByEmailAddress(ctx, identifier);
        if (existing)
            return existing;
        const newUser = await this.userService.createCustomerUser(ctx, identifier);
        if ('identifier' in newUser) {
            return newUser;
        }
        return false;
    }
}
exports.DouyinAuthenticationStrategy = DouyinAuthenticationStrategy;
//# sourceMappingURL=douyin-auth-strategy.js.map