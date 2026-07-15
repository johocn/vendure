import { Injector, RequestContext, User, UserService, AuthenticationStrategy, ForbiddenError } from '@vendure/core';
import { gql } from 'graphql-tag';
import { getAuthOverride, isAuthMethodEnabled } from '@vendure/cjk-plugin';
import { AlipayAuthService } from './alipay-auth.service';
import { AlipayPluginOptions } from './types';

export interface AlipayAuthData {
    authCode: string;
    type: 'h5' | 'mini';
}

export class AlipayAuthenticationStrategy implements AuthenticationStrategy<AlipayAuthData> {
    readonly name = 'alipay';
    private userService: UserService;
    private alipayAuthService: AlipayAuthService;

    constructor(private options: AlipayPluginOptions) {}

    init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.alipayAuthService = new AlipayAuthService(this.options);
    }

    defineInputType() {
        return gql`
            input AlipayAuthInput {
                authCode: String!
                type: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: AlipayAuthData): Promise<User | false | string> {
        // 租户级登录方式开关检查（先于 devBypass）
        if (!isAuthMethodEnabled(ctx, 'alipay')) {
            throw new ForbiddenError();
        }

        const authConfig = this.options.auth || {};

        // devBypass 分支（保持原样，不使用 override）
        if (authConfig.devBypass) {
            const testOpenid = authConfig.devBypassOpenid || 'dev_test_openid';
            const identifier = `alipay_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }

        // 租户凭证覆盖（已解密；无覆盖则回退 this.options.auth）
        const override = getAuthOverride(ctx, 'alipay');
        const authConfigOpts = override || this.options.auth || {};

        // 真实分支
        try {
            const openid = await this.alipayAuthService.getOpenidByAuthCode(data.authCode, authConfigOpts);
            const identifier = `alipay_${data.type}_${openid}`;
            return this.findOrCreateUser(ctx, identifier);
        } catch (e) {
            return false;
        }
    }

    private async findOrCreateUser(ctx: RequestContext, identifier: string): Promise<User | false> {
        const existing = await this.userService.getUserByEmailAddress(ctx, identifier);
        if (existing) return existing;
        const newUser = await this.userService.createCustomerUser(ctx, identifier);
        if ('identifier' in newUser) {
            return newUser as User;
        }
        return false;
    }
}
