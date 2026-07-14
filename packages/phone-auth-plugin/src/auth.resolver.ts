import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
    Allow,
    Ctx,
    InvalidCredentialsError,
    isGraphQlErrorResult,
    Permission,
    RequestContext,
    UserService,
} from '@vendure/core';
import { PHONE_AUTH_PLUGIN_OPTIONS } from './constants';
import { PhoneAuthPluginOptions, RegisterCustomerInput } from './types';
import { SmsService } from './sms.service';

@Resolver()
export class PhoneAuthResolver {
    constructor(
        @Inject(PHONE_AUTH_PLUGIN_OPTIONS) private options: PhoneAuthPluginOptions,
        private smsService: SmsService,
        private userService: UserService,
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
    ): Promise<any> {
        const { phoneNumber, code, password, emailAddress } = args.input;

        const verified = this.smsService.verifyCode(phoneNumber, code);
        if (!verified) {
            return new InvalidCredentialsError({ authenticationError: '验证码错误或已过期' });
        }

        const existing = await this.userService.getUserByEmailAddress(ctx, phoneNumber);
        if (existing) {
            return { success: true };
        }

        const user = await this.userService.createCustomerUser(ctx, phoneNumber, password);
        if (isGraphQlErrorResult(user)) {
            return user;
        }

        // 注：不在此处创建 Customer，避免 customerService.create 内部再次创建 User 导致双 User
        // Customer 将在用户首次下单时由 Vendure 自动创建

        return { success: true };
    }
}
