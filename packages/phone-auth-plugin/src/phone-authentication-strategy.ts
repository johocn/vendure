import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { AuthenticationStrategy, Injector, Logger, RequestContext, User, UserService } from '@vendure/core';

import { loggerCtx } from './constants';
import { SmsService } from './sms.service';
import { PhoneAuthPluginOptions } from './types';

export interface PhoneAuthData {
    phoneNumber: string;
    code: string;
}

export class PhoneAuthenticationStrategy implements AuthenticationStrategy<PhoneAuthData> {
    readonly name = 'phone';

    private smsService: SmsService;
    private userService: UserService;

    constructor(private options: PhoneAuthPluginOptions) {
        this.smsService = new SmsService(options);
    }

    async init(injector: Injector) {
        this.userService = injector.get(UserService);
    }

    defineInputType(): DocumentNode {
        return gql`
            input PhoneAuthInput {
                phoneNumber: String!
                code: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: PhoneAuthData): Promise<User | false | string> {
        const { phoneNumber, code } = data;

        if (!this.smsService.verifyCode(phoneNumber, code)) {
            return '验证码错误或已过期';
        }

        try {
            const user = await this.userService.getUserByEmailAddress(ctx, phoneNumber);
            if (user) {
                return user;
            }

            const result = await this.userService.createCustomerUser(ctx, phoneNumber);
            if ('identifier' in result) {
                return result as User;
            }

            return false;
        } catch (e: any) {
            Logger.error(`Phone auth failed: ${e.message}`, loggerCtx);
            return false;
        }
    }
}
