import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { AuthenticationStrategy, ForbiddenError, Injector, RequestContext, User, UserService } from '@vendure/core';
import { getAuthOverride, isAuthMethodEnabled } from '@vendure/cjk-plugin';

import { DouyinAuthService } from './douyin-auth.service';
import { DouyinAuthPluginOptions } from './types';

export interface DouyinAuthData {
    code: string;
    type: 'h5' | 'mini';
}

export class DouyinAuthenticationStrategy implements AuthenticationStrategy<DouyinAuthData> {
    readonly name = 'douyin';

    private userService: UserService;
    private douyinAuthService: DouyinAuthService;

    constructor(private options: DouyinAuthPluginOptions) {}

    init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.douyinAuthService = new DouyinAuthService(this.options);
    }

    defineInputType(): DocumentNode {
        return gql`
            input DouyinAuthInput {
                code: String!
                type: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: DouyinAuthData): Promise<User | false | string> {
        // 租户级登录方式开关检查（先于 devBypass）
        if (!isAuthMethodEnabled(ctx, 'douyin')) {
            throw new ForbiddenError();
        }

        // devBypass 分支（保持原样，不使用 override）
        if (this.options.devBypass) {
            const testOpenid = this.options.devBypassOpenid || 'dev_test_openid';
            const identifier = `douyin_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }

        // 租户凭证覆盖（已解密；无覆盖则回退 this.options）
        const override = getAuthOverride(ctx, 'douyin');
        const appId = override?.appId || this.options.appId;
        const appSecret = override?.appSecret || this.options.appSecret;
        const miniProgramAppId = override?.miniProgramAppId || this.options.miniProgramAppId;
        const miniProgramAppSecret = override?.miniProgramAppSecret || this.options.miniProgramAppSecret;

        try {
            const openid = await this.douyinAuthService.getOpenidByCode(data.code, appId, appSecret, miniProgramAppId, miniProgramAppSecret);
            const identifier = `douyin_${data.type}_${openid}`;
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
