import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { Injectable } from '@nestjs/common';
import { AuthenticationStrategy, Logger, RequestContext, User } from '@vendure/core';
import { UserService } from '@vendure/core';

import { loggerCtx } from './constants';
import { SmsService } from './sms.service';

export interface PhoneAuthData {
    phoneNumber: string;
    code: string;
}

@Injectable()
export class PhoneAuthenticationStrategy implements AuthenticationStrategy<PhoneAuthData> {
    readonly name = 'phone';

    constructor(
        private smsService: SmsService,
        private userService: UserService,
    ) {}

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
