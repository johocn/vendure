import { DocumentNode } from 'graphql';
import { AuthenticationStrategy, Injector, RequestContext, User } from '@vendure/core';
import { WechatAuthPluginOptions } from './types';
export interface WechatAuthData {
    code: string;
    type: 'mp' | 'mini';
}
export declare class WechatAuthenticationStrategy implements AuthenticationStrategy<WechatAuthData> {
    private options;
    readonly name = "wechat";
    private userService;
    constructor(options: WechatAuthPluginOptions);
    init(injector: Injector): Promise<void>;
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: WechatAuthData): Promise<User | false | string>;
    private getMpOpenid;
    private getMiniOpenid;
}
