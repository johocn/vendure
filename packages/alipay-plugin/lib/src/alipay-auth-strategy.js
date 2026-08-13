"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlipayAuthenticationStrategy = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const alipay_auth_service_1 = require("./alipay-auth.service");
class AlipayAuthenticationStrategy {
    constructor(options) {
        this.options = options;
        this.name = 'alipay';
    }
    init(injector) {
        this.userService = injector.get(core_1.UserService);
        this.alipayAuthService = new alipay_auth_service_1.AlipayAuthService(this.options);
    }
    defineInputType() {
        return (0, graphql_tag_1.gql) `
            input AlipayAuthInput {
                authCode: String!
                type: String!
            }
        `;
    }
    async authenticate(ctx, data) {
        // 租户级登录方式开关检查（先于 devBypass）
        if (!(0, cjk_plugin_1.isAuthMethodEnabled)(ctx, 'alipay')) {
            throw new core_1.ForbiddenError();
        }
        const authConfig = this.options.auth || {};
        // devBypass 分支（保持原样，不使用 override）
        if (authConfig.devBypass) {
            const testOpenid = authConfig.devBypassOpenid || 'dev_test_openid';
            const identifier = `alipay_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }
        // 租户凭证覆盖（已解密；无覆盖则回退 this.options.auth）
        const override = (0, cjk_plugin_1.getAuthOverride)(ctx, 'alipay');
        const authConfigOpts = override || this.options.auth || {};
        // 真实分支
        try {
            const openid = await this.alipayAuthService.getOpenidByAuthCode(data.authCode, authConfigOpts);
            const identifier = `alipay_${data.type}_${openid}`;
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
exports.AlipayAuthenticationStrategy = AlipayAuthenticationStrategy;
//# sourceMappingURL=alipay-auth-strategy.js.map