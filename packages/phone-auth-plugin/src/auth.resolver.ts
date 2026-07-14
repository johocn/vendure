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
        const { phoneNumber, code, password } = args.input;

        const verified = this.smsService.verifyCode(phoneNumber, code);
        if (!verified) {
            throw new UserInputError('验证码错误或已过期');
        }

        const result = await this.customerService.registerCustomerAccount(ctx, {
            emailAddress: phoneNumber,
            password,
            phoneNumber,
        });

        if (isGraphQlErrorResult(result)) {
            if (result.errorCode === 'EMAIL_ADDRESS_CONFLICT_ERROR') {
                return { success: true };
            }
            throw new UserInputError(result.message || '注册失败');
        }

        return { success: true };
    }
}
