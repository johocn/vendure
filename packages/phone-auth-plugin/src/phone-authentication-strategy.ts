import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { AuthenticationStrategy, ForbiddenError, Injector, Logger, RequestContext, User, UserService } from '@vendure/core';
import { getAuthOverride, isAuthMethodEnabled } from '@vendure/cjk-plugin';

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

    constructor(private options: PhoneAuthPluginOptions) {}

    async init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.smsService = injector.get(SmsService);
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
        // 租户级登录方式开关检查（"未启用"属权限错误，抛 ForbiddenError）
        if (!isAuthMethodEnabled(ctx, 'phone')) {
            throw new ForbiddenError();
        }

        // 租户凭证覆盖（已解密；无覆盖则回退 this.options；当前策略 authenticate 仅校验 code，凭证由 SmsService 在发码时使用）
        const override = getAuthOverride(ctx, 'phone');
        const accessKeyId = override?.accessKeyId || this.options.accessKeyId;
        const accessKeySecret = override?.accessKeySecret || this.options.accessKeySecret;
        const signName = override?.signName || this.options.signName;
        const templateCode = override?.templateCode || this.options.templateCode;

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
