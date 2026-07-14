import { DocumentNode } from 'graphql';
import { AuthenticationStrategy, Injector, RequestContext, User } from '@vendure/core';
import { DouyinAuthPluginOptions } from './types';
export interface DouyinAuthData {
    code: string;
    type: 'h5' | 'mini';
}
export declare class DouyinAuthenticationStrategy implements AuthenticationStrategy<DouyinAuthData> {
    private options;
    readonly name = "douyin";
    private userService;
    private douyinAuthService;
    constructor(options: DouyinAuthPluginOptions);
    init(injector: Injector): void;
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: DouyinAuthData): Promise<User | false | string>;
    private findOrCreateUser;
}
