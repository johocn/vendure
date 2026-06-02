import { DocumentNode } from 'graphql';
import { AuthenticationStrategy, RequestContext, User, UserService } from '@vendure/core';
import { WechatAuthPluginOptions } from './types';
export interface WechatAuthData {
    code: string;
    type: 'mp' | 'mini';
}
export declare class WechatAuthenticationStrategy implements AuthenticationStrategy<WechatAuthData> {
    private options;
    private userService;
    readonly name = "wechat";
    constructor(options: WechatAuthPluginOptions, userService: UserService);
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: WechatAuthData): Promise<User | false | string>;
    private getMpOpenid;
    private getMiniOpenid;
}
