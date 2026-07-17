"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsoAuthenticationStrategy = void 0;
// e:\code\vendure\packages\cjk-plugin\src\auth\sso-authentication-strategy.ts
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
const crypto_1 = require("./crypto");
const invite_code_service_1 = require("./invite-code.service");
const loggerCtx = 'SsoAuthenticationStrategy';
class SsoAuthenticationStrategy {
    constructor() {
        this.name = 'sso';
    }
    async init(injector) {
        this.userService = injector.get(core_1.UserService);
        this.customerService = injector.get(core_1.CustomerService);
        this.inviteCodeService = injector.get(invite_code_service_1.InviteCodeService);
    }
    defineInputType() {
        return (0, graphql_tag_1.gql) `
            input SsoAuthInput {
                providerKey: String!
                code: String!
                inviteCode: String
            }
        `;
    }
    async authenticate(ctx, data) {
        const config = (0, crypto_1.readChannelAuthConfig)(ctx);
        if (!(config === null || config === void 0 ? void 0 : config.ssoProviders) || config.ssoProviders.length === 0) {
            core_1.Logger.warn('No SSO providers configured for channel', loggerCtx);
            return false;
        }
        const provider = config.ssoProviders.find(p => p.providerKey === data.providerKey);
        if (!provider) {
            core_1.Logger.warn(`SSO provider "${data.providerKey}" not found`, loggerCtx);
            return false;
        }
        try {
            // 1. 换取 access_token（后端不依赖 redirect_uri）
            const tokenRes = await this.exchangeCodeForToken(provider, data.code);
            if (!(tokenRes === null || tokenRes === void 0 ? void 0 : tokenRes.access_token)) {
                core_1.Logger.warn('SSO token exchange failed', loggerCtx);
                return false;
            }
            // 2. 获取用户信息
            const userInfo = await this.getUserInfo(provider, tokenRes.access_token);
            if (!userInfo) {
                return false;
            }
            // 3. 映射字段
            const externalId = this.getField(userInfo, provider, 'externalIdField', provider.protocol === 'zhao-sso' ? 'uuid' : 'sub');
            if (!externalId) {
                core_1.Logger.warn('SSO userInfo missing externalId field', loggerCtx);
                return false;
            }
            const email = this.getField(userInfo, provider, 'emailField', 'email');
            const nickname = this.getField(userInfo, provider, 'nicknameField', provider.protocol === 'zhao-sso' ? 'nickname' : 'name');
            const mobile = this.getField(userInfo, provider, 'mobileField', 'mobile');
            const avatar = this.getField(userInfo, provider, 'avatarField', 'avatar_url');
            // 4. 查找或创建 Customer
            const identifier = `sso_${provider.providerKey}_${externalId}`;
            const result = await this.findOrCreateUser(ctx, identifier, email, nickname, mobile, avatar);
            // inviteCode 衔接:优先用 data.inviteCode,否则尝试从 userInfo.invite_code 取
            if (result && typeof result === 'object') {
                const finalInviteCode = data.inviteCode || (userInfo === null || userInfo === void 0 ? void 0 : userInfo.invite_code);
                if (finalInviteCode) {
                    try {
                        await this.inviteCodeService.bindIfPresent(ctx, String(result.id), String(finalInviteCode));
                    }
                    catch (e) {
                        core_1.Logger.warn(`Failed to bind invite code: ${e.message}`, loggerCtx);
                    }
                }
            }
            return result;
        }
        catch (e) {
            core_1.Logger.error(`SSO authentication failed: ${e.message}`, loggerCtx);
            return false;
        }
    }
    getFieldValue(userInfo, mappingField, defaultField) {
        const field = mappingField || defaultField;
        return userInfo[field] || '';
    }
    getField(userInfo, provider, mappingKey, defaultField) {
        var _a;
        const mappingField = (_a = provider.userInfoMapping) === null || _a === void 0 ? void 0 : _a[mappingKey];
        return this.getFieldValue(userInfo, mappingField, defaultField);
    }
    async exchangeCodeForToken(provider, code) {
        if (provider.protocol === 'zhao-sso') {
            const tokenUrl = `${provider.baseUrl.replace(/\/$/, '')}/v1/auth/token`;
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code,
                    app_code: provider.clientId,
                    app_secret: provider.clientSecret,
                }),
            });
            return res.json();
        }
        else {
            const tokenUrl = provider.tokenUrl;
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    client_id: provider.clientId,
                    client_secret: provider.clientSecret,
                }),
            });
            return res.json();
        }
    }
    async getUserInfo(provider, accessToken) {
        const userInfoUrl = provider.protocol === 'zhao-sso'
            ? `${provider.baseUrl.replace(/\/$/, '')}/v1/user/me`
            : provider.userInfoUrl;
        const res = await fetch(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
            core_1.Logger.warn(`SSO userInfo request failed: ${res.status}`, loggerCtx);
            return null;
        }
        return res.json();
    }
    async findOrCreateUser(ctx, identifier, email, nickname, mobile, avatar) {
        let user = await this.userService.getUserByEmailAddress(ctx, identifier);
        if (!user) {
            const result = await this.userService.createCustomerUser(ctx, identifier);
            if ('identifier' in result) {
                user = result;
            }
            else {
                return false;
            }
        }
        // 可选：更新 Customer 资料（email/nickname 等）
        try {
            const customer = await this.customerService.findOneByUserId(ctx, user.id);
            if (customer) {
                await this.customerService.update(ctx, Object.assign(Object.assign({ id: customer.id }, (email ? { emailAddress: email } : {})), (nickname ? { firstName: nickname } : {})));
            }
        }
        catch (e) {
            core_1.Logger.warn(`Failed to update SSO customer profile: ${e.message}`, loggerCtx);
        }
        return user;
    }
}
exports.SsoAuthenticationStrategy = SsoAuthenticationStrategy;
//# sourceMappingURL=sso-authentication-strategy.js.map