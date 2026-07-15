import { AuthenticationStrategy, RequestContext, User, Injector } from '@vendure/core';
interface SsoAuthData {
    providerKey: string;
    code: string;
}
export declare class SsoAuthenticationStrategy implements AuthenticationStrategy<SsoAuthData> {
    readonly name = "sso";
    private userService;
    private customerService;
    init(injector: Injector): Promise<void>;
    defineInputType(): import("graphql").DocumentNode;
    authenticate(ctx: RequestContext, data: SsoAuthData): Promise<User | false | string>;
    private getFieldValue;
    private getField;
    private exchangeCodeForToken;
    private getUserInfo;
    private findOrCreateUser;
}
export {};
