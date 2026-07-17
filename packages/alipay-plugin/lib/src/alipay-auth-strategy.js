"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlipayAuthenticationStrategy = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
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
        const authConfig = this.options.auth || {};
        // devBypass 分支
        if (authConfig.devBypass) {
            const testOpenid = authConfig.devBypassOpenid || 'dev_test_openid';
            const identifier = `alipay_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }
        // 真实分支
        try {
            const openid = await this.alipayAuthService.getOpenidByAuthCode(data.authCode);
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