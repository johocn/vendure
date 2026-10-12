import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
    Allow,
    Ctx,
    CustomerService,
    ForbiddenError,
    isGraphQlErrorResult,
    Permission,
    RequestContext,
    UserInputError,
} from '@vendure/core';
import { getAuthOverride, isAuthMethodEnabled } from '@vendure/cjk-plugin';
import { PHONE_AUTH_PLUGIN_OPTIONS } from './constants';
import { PhoneAuthPluginOptions, RegisterCustomerInput } from './types';
import { SmsService } from './sms.service';

/** 大陆手机号格式 */
const PHONE_NUMBER_RE = /^1[3-9]\d{9}$/;

@Resolver()
export class PhoneAuthResolver {
    constructor(
        @Inject(PHONE_AUTH_PLUGIN_OPTIONS) private options: PhoneAuthPluginOptions,
        private smsService: SmsService,
        private customerService: CustomerService,
    ) {}

    @Mutation()
    @Allow(Permission.Public)
    async sendPhoneVerificationCode(@Ctx() ctx: RequestContext, @Args('phoneNumber') phoneNumber: string): Promise<boolean> {
        // 租户级登录方式开关（未启用即权限错误）
        if (!isAuthMethodEnabled(ctx, 'phone')) {
            throw new ForbiddenError();
        }
        if (!PHONE_NUMBER_RE.test(phoneNumber)) {
            throw new UserInputError('手机号格式不正确');
        }
        // 发送频率限制：60s 冷却 + 同号每日上限（防短信轰炸/费用消耗）
        const limited = await this.smsService.checkRateLimit(phoneNumber);
        if (limited) {
            return false;
        }
        // 租户级凭证覆盖（已解密）：租户自行配置的阿里云凭证/签名/模板优先于全局 options
        const override = getAuthOverride(ctx, 'phone');
        const credentials = override
            ? {
                  accessKeyId: override.accessKeyId || this.options.accessKeyId,
                  accessKeySecret: override.accessKeySecret || this.options.accessKeySecret,
                  signName: override.signName || this.options.signName,
                  templateCode: override.templateCode || this.options.templateCode,
              }
            : undefined;
        return this.smsService.sendVerificationCode(phoneNumber, credentials);
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
            if (!PHONE_NUMBER_RE.test(phoneNumber!)) {
                throw new UserInputError('手机号格式不正确');
            }
            if (!code) {
                throw new UserInputError('手机号注册必须提供验证码');
            }
            // verifyCode 是 async：漏 await 会得到恒真值的 Promise，令校验失效
            const verified = await this.smsService.verifyCode(phoneNumber!, code);
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
