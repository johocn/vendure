import { DocumentNode } from 'graphql';
import { AuthenticationStrategy, RequestContext, User } from '@vendure/core';
import { UserService } from '@vendure/core';
import { SmsService } from './sms.service';
export interface PhoneAuthData {
    phoneNumber: string;
    code: string;
}
export declare class PhoneAuthenticationStrategy implements AuthenticationStrategy<PhoneAuthData> {
    private smsService;
    private userService;
    readonly name = "phone";
    constructor(smsService: SmsService, userService: UserService);
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: PhoneAuthData): Promise<User | false | string>;
}
