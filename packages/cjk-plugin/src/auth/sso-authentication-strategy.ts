// e:\code\vendure\packages\cjk-plugin\src\auth\sso-authentication-strategy.ts
import { AuthenticationStrategy, RequestContext, User, Logger, Injector, UserService, CustomerService } from '@vendure/core';
import { gql } from 'graphql-tag';
import type { SsoProvider } from './auth-config.types';
import { readChannelAuthConfig } from './crypto';

const loggerCtx = 'SsoAuthenticationStrategy';

interface SsoAuthData {
    providerKey: string;
    code: string;
}

export class SsoAuthenticationStrategy implements AuthenticationStrategy<SsoAuthData> {
    readonly name = 'sso';

    private userService!: UserService;
    private customerService!: CustomerService;

    async init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.customerService = injector.get(CustomerService);
    }

    defineInputType() {
        return gql`
            input SsoAuthInput {
                providerKey: String!
                code: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: SsoAuthData): Promise<User | false | string> {
        const config = readChannelAuthConfig(ctx);
        if (!config?.ssoProviders || config.ssoProviders.length === 0) {
            Logger.warn('No SSO providers configured for channel', loggerCtx);
            return false;
        }

        const provider = config.ssoProviders.find(p => p.providerKey === data.providerKey);
        if (!provider) {
            Logger.warn(`SSO provider "${data.providerKey}" not found`, loggerCtx);
            return false;
        }

        try {
            // 1. 换取 access_token（后端不依赖 redirect_uri）
            const tokenRes = await this.exchangeCodeForToken(provider, data.code);
            if (!tokenRes?.access_token) {
                Logger.warn('SSO token exchange failed', loggerCtx);
                return false;
            }

            // 2. 获取用户信息
            const userInfo = await this.getUserInfo(provider, tokenRes.access_token);
            if (!userInfo) {
                return false;
            }

            // 3. 映射字段
            const externalId = this.getField(userInfo, provider, 'externalIdField',
                provider.protocol === 'zhao-sso' ? 'uuid' : 'sub');
            if (!externalId) {
                Logger.warn('SSO userInfo missing externalId field', loggerCtx);
                return false;
            }

            const email = this.getField(userInfo, provider, 'emailField', 'email');
            const nickname = this.getField(userInfo, provider, 'nicknameField',
                provider.protocol === 'zhao-sso' ? 'nickname' : 'name');
            const mobile = this.getField(userInfo, provider, 'mobileField', 'mobile');
            const avatar = this.getField(userInfo, provider, 'avatarField', 'avatar_url');

            // 4. 查找或创建 Customer
            const identifier = `sso_${provider.providerKey}_${externalId}`;
            return await this.findOrCreateUser(ctx, identifier, email, nickname, mobile, avatar);
        } catch (e: any) {
            Logger.error(`SSO authentication failed: ${e.message}`, loggerCtx);
            return false;
        }
    }

    private getFieldValue(userInfo: any, mappingField: string | undefined, defaultField: string): string {
        const field = mappingField || defaultField;
        return userInfo[field] || '';
    }

    private getField(userInfo: any, provider: SsoProvider, mappingKey: keyof NonNullable<SsoProvider['userInfoMapping']>, defaultField: string): string {
        const mappingField = provider.userInfoMapping?.[mappingKey];
        return this.getFieldValue(userInfo, mappingField, defaultField);
    }

    private async exchangeCodeForToken(provider: SsoProvider, code: string): Promise<any> {
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
        } else {
            const tokenUrl = provider.tokenUrl!;
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

    private async getUserInfo(provider: SsoProvider, accessToken: string): Promise<any | null> {
        const userInfoUrl = provider.protocol === 'zhao-sso'
            ? `${provider.baseUrl.replace(/\/$/, '')}/v1/user/me`
            : provider.userInfoUrl!;

        const res = await fetch(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
            Logger.warn(`SSO userInfo request failed: ${res.status}`, loggerCtx);
            return null;
        }
        return res.json();
    }

    private async findOrCreateUser(
        ctx: RequestContext,
        identifier: string,
        email: string,
        nickname: string,
        mobile: string,
        avatar: string,
    ): Promise<User | false> {
        let user = await this.userService.getUserByEmailAddress(ctx, identifier);
        if (!user) {
            const result = await this.userService.createCustomerUser(ctx, identifier);
            if ('identifier' in result) {
                user = result as User;
            } else {
                return false;
            }
        }
        // 可选：更新 Customer 资料（email/nickname 等）
        try {
            const customer = await this.customerService.findOneByUserId(ctx, user.id);
            if (customer) {
                await this.customerService.update(ctx, {
                    id: customer.id,
                    ...(email ? { emailAddress: email } : {}),
                    ...(nickname ? { firstName: nickname } : {}),
                });
            }
        } catch (e: any) {
            Logger.warn(`Failed to update SSO customer profile: ${e.message}`, loggerCtx);
        }
        return user;
    }
}
