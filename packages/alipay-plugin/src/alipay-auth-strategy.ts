import { Injector, RequestContext, User, UserService, AuthenticationStrategy } from '@vendure/core';
import { gql } from 'graphql-tag';
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
