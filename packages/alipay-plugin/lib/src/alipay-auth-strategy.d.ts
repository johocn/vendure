import { Injector, RequestContext, User, AuthenticationStrategy } from '@vendure/core';
import { AlipayPluginOptions } from './types';
export interface AlipayAuthData {
    authCode: string;
    type: 'h5' | 'mini';
}
export declare class AlipayAuthenticationStrategy implements AuthenticationStrategy<AlipayAuthData> {
    private options;
    readonly name = "alipay";
    private userService;
    private alipayAuthService;
    constructor(options: AlipayPluginOptions);
    init(injector: Injector): void;
    defineInputType(): import("graphql").DocumentNode;
    authenticate(ctx: RequestContext, data: AlipayAuthData): Promise<User | false | string>;
    private findOrCreateUser;
}
