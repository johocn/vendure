"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAuthenticationStrategy = void 0;
const core_1 = require("@vendure/core");
const google_auth_library_1 = require("google-auth-library");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
class GoogleAuthenticationStrategy {
    constructor(clientId) {
        this.clientId = clientId;
        this.name = 'google';
        this.client = new google_auth_library_1.OAuth2Client(clientId);
    }
    init(injector) {
        this.externalAuthenticationService = injector.get(core_1.ExternalAuthenticationService);
    }
    defineInputType() {
        return (0, graphql_tag_1.default) `
            input GoogleAuthInput {
                token: String!
            }
        `;
    }
    /**
     * Implements https://developers.google.com/identity/sign-in/web/backend-auth
     */
    async authenticate(ctx, data) {
        const ticket = await this.client.verifyIdToken({
            idToken: data.token,
            audience: this.clientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return false;
        }
        const user = await this.externalAuthenticationService.findCustomerUser(ctx, this.name, payload.sub);
        if (user) {
            return user;
        }
        return this.externalAuthenticationService.createCustomerAndUser(ctx, {
            strategy: this.name,
            externalIdentifier: payload.sub,
            verified: payload.email_verified || false,
            emailAddress: payload.email,
            firstName: payload.given_name,
            lastName: payload.family_name,
        });
    }
}
exports.GoogleAuthenticationStrategy = GoogleAuthenticationStrategy;
//# sourceMappingURL=google-authentication-strategy.js.map