import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { AuthenticationStrategy, Injector, Logger, RequestContext, User, UserService } from '@vendure/core';

import { loggerCtx } from './constants';
import { WechatAuthPluginOptions } from './types';

export interface WechatAuthData {
    code: string;
    type: 'mp' | 'mini';
}

export class WechatAuthenticationStrategy implements AuthenticationStrategy<WechatAuthData> {
    readonly name = 'wechat';

    private userService: UserService;

    constructor(private options: WechatAuthPluginOptions) {}

    async init(injector: Injector) {
        this.userService = injector.get(UserService);
    }

    defineInputType(): DocumentNode {
        return gql`
            input WechatAuthInput {
                code: String!
                type: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: WechatAuthData): Promise<User | false | string> {
        const { code, type } = data;

        try {
            let openid: string;
            if (type === 'mp') {
                openid = await this.getMpOpenid(code);
            } else {
                openid = await this.getMiniOpenid(code);
            }

            if (!openid) {
                return '微信授权失败';
            }

            const identifier = type === 'mp' ? `wechat_mp_${openid}` : `wechat_mini_${openid}`;
            const user = await this.userService.getUserByEmailAddress(ctx, identifier);
            if (user) {
                return user;
            }

            const result = await this.userService.createCustomerUser(ctx, identifier);
            if ('identifier' in result) {
                return result as User;
            }

            return false;
        } catch (e: any) {
            Logger.error(`WeChat auth failed: ${e.message}`, loggerCtx);
            return false;
        }
    }

    private async getMpOpenid(code: string): Promise<string> {
        const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${this.options.appId}&secret=${this.options.appSecret}&code=${code}&grant_type=authorization_code`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        return data.openid;
    }

    private async getMiniOpenid(code: string): Promise<string> {
        const appId = this.options.miniProgramAppId || this.options.appId;
        const secret = this.options.miniProgramAppSecret || this.options.appSecret;
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        return data.openid;
    }
}
