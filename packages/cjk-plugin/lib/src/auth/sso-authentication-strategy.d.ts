import { AuthenticationStrategy, RequestContext, User, Injector } from '@vendure/core';
import { DocumentNode } from 'graphql';
interface SsoAuthData {
    providerKey: string;
    code: string;
    inviteCode?: string;
    redirectUri?: string;
}
export declare class SsoAuthenticationStrategy implements AuthenticationStrategy<SsoAuthData> {
    readonly name = "sso";
    private userService;
    private customerService;
    private inviteCodeService;
    private distributionService?;
    init(injector: Injector): Promise<void>;
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: SsoAuthData): Promise<User | false | string>;
    private getFieldValue;
    private getField;
    private exchangeCodeForToken;
    private getUserInfo;
    private findOrCreateUser;
}
export {};
