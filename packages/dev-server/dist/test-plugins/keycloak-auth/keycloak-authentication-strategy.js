"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeycloakAuthenticationStrategy = void 0;
const axios_1 = require("@nestjs/axios");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
class KeycloakAuthenticationStrategy {
    constructor() {
        this.name = 'keycloak';
    }
    init(injector) {
        this.externalAuthenticationService = injector.get(core_1.ExternalAuthenticationService);
        this.httpService = injector.get(axios_1.HttpService);
        this.connection = injector.get(core_1.TransactionalConnection);
    }
    defineInputType() {
        return (0, graphql_tag_1.default) `
            input KeycloakAuthInput {
                token: String!
            }
        `;
    }
    async authenticate(ctx, data) {
        var _a, _b;
        let userInfo;
        this.bearerToken = data.token;
        try {
            const response = await this.httpService
                .get('http://localhost:9000/realms/myrealm/protocol/openid-connect/userinfo', {
                headers: {
                    Authorization: `Bearer ${this.bearerToken}`,
                },
            })
                .toPromise();
            userInfo = response === null || response === void 0 ? void 0 : response.data;
        }
        catch (e) {
            core_1.Logger.error(e);
            return false;
        }
        if (!userInfo) {
            return false;
        }
        const user = await this.externalAuthenticationService.findAdministratorUser(ctx, this.name, userInfo.sub);
        if (user) {
            return user;
        }
        const merchantRole = await this.connection.getRepository(ctx, core_1.Role).findOne({
            where: { code: 'merchant' },
        });
        if (!merchantRole) {
            core_1.Logger.error(`Could not find "merchant" role`);
            return false;
        }
        return this.externalAuthenticationService.createAdministratorAndUser(ctx, {
            strategy: this.name,
            externalIdentifier: userInfo.sub,
            identifier: userInfo.preferred_username,
            emailAddress: userInfo.email,
            firstName: (_a = userInfo.given_name) !== null && _a !== void 0 ? _a : userInfo.preferred_username,
            lastName: (_b = userInfo.family_name) !== null && _b !== void 0 ? _b : userInfo.preferred_username,
            roles: [merchantRole],
        });
    }
}
exports.KeycloakAuthenticationStrategy = KeycloakAuthenticationStrategy;
//# sourceMappingURL=keycloak-authentication-strategy.js.map