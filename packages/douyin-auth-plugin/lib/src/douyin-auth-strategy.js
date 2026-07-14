"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DouyinAuthenticationStrategy = void 0;
const graphql_tag_1 = require("graphql-tag");
const core_1 = require("@vendure/core");
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
        if (this.options.devBypass) {
            const testOpenid = this.options.devBypassOpenid || 'dev_test_openid';
            const identifier = `douyin_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }
        try {
            const openid = await this.douyinAuthService.getOpenidByCode(data.code);
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