import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
    Allow,
    Ctx,
    CustomerService,
    isGraphQlErrorResult,
    Permission,
    RequestContext,
    UserInputError,
} from '@vendure/core';
import { PHONE_AUTH_PLUGIN_OPTIONS } from './constants';
import { PhoneAuthPluginOptions, RegisterCustomerInput } from './types';
import { SmsService } from './sms.service';

@Resolver()
export class PhoneAuthResolver {
    constructor(
        @Inject(PHONE_AUTH_PLUGIN_OPTIONS) private options: PhoneAuthPluginOptions,
        private smsService: SmsService,
        private customerService: CustomerService,
    ) {}

    @Mutation()
    async sendPhoneVerificationCode(@Args('phoneNumber') phoneNumber: string): Promise<boolean> {
        return this.smsService.sendVerificationCode(phoneNumber);
    }

    @Mutation()
    @Allow(Permission.Public)
    async registerCustomer(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: RegisterCustomerInput },
    ): Promise<{ success: boolean }> {
        const { phoneNumber, code, password, emailAddress } = args.input;

        // 分派：手机号注册 or 邮箱注册（二选一）
        const isPhoneMode = !!phoneNumber;
        const isEmailMode = !!emailAddress && !phoneNumber;
        if (!isPhoneMode && !isEmailMode) {
            throw new UserInputError('必须提供 phoneNumber 或 emailAddress 之一');
        }

        let identifier: string;
        let resolvedPhone: string | undefined;

        if (isPhoneMode) {
            if (!code) {
                throw new UserInputError('手机号注册必须提供验证码');
            }
            const verified = this.smsService.verifyCode(phoneNumber!, code);
            if (!verified) {
                throw new UserInputError('验证码错误或已过期');
            }
            identifier = phoneNumber!;
            resolvedPhone = phoneNumber!;
            // 手机号作为 identifier 存储（非邮箱格式不会被 normalize 转小写）
        } else {
            identifier = emailAddress!;
        }

        const result = await this.customerService.registerCustomerAccount(ctx, {
            emailAddress: identifier,
            password,
            phoneNumber: resolvedPhone,
        });

        if (isGraphQlErrorResult(result)) {
            if (result.errorCode === 'EMAIL_ADDRESS_CONFLICT_ERROR') {
                // 防账户枚举：已存在时返回 success
                return { success: true };
            }
            throw new UserInputError(result.message || '注册失败');
        }

        return { success: true };
    }
}
