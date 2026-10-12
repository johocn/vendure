import { DocumentNode } from 'graphql';
import { AuthenticationStrategy, Injector, RequestContext, User } from '@vendure/core';
import { PhoneAuthPluginOptions } from './types';
export interface PhoneAuthData {
    phoneNumber: string;
    code: string;
}
export declare class PhoneAuthenticationStrategy implements AuthenticationStrategy<PhoneAuthData> {
    private options;
    readonly name = "phone";
    private smsService;
    private userService;
    private externalAuthService;
    private connection;
    private channelService;
    private customerService;
    constructor(options: PhoneAuthPluginOptions);
    init(injector: Injector): Promise<void>;
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: PhoneAuthData): Promise<User | false | string>;
}
