"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSOShopAuthenticationStrategy = void 0;
const axios_1 = require("@nestjs/axios");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
class SSOShopAuthenticationStrategy {
    constructor() {
        this.name = 'ssoShop';
    }
    init(injector) {
        this.externalAuthenticationService = injector.get(core_1.ExternalAuthenticationService);
        this.httpService = injector.get(axios_1.HttpService);
        this.roleService = injector.get(core_1.RoleService);
    }
    defineInputType() {
        return (0, graphql_tag_1.default) `
            input SSOAuthInput {
                email: String!
            }
        `;
    }
    async authenticate(ctx, data) {
        if (data.email !== 'test@test.com') {
            return false;
        }
        const user = await this.externalAuthenticationService.findCustomerUser(ctx, this.name, data.email);
        if (user) {
            return user;
        }
        return this.externalAuthenticationService.createCustomerAndUser(ctx, {
            strategy: this.name,
            externalIdentifier: data.email,
            emailAddress: data.email,
            firstName: 'test',
            lastName: 'customer',
            verified: true,
        });
    }
}
exports.SSOShopAuthenticationStrategy = SSOShopAuthenticationStrategy;
//# sourceMappingURL=sso-auth-strategy.js.map