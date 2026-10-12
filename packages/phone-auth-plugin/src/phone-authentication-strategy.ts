import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { AuthenticationStrategy, ChannelService, Customer, CustomerService, ExternalAuthenticationService, ForbiddenError, Injector, Logger, RequestContext, TransactionalConnection, User, UserService } from '@vendure/core';
import { isAuthMethodEnabled } from '@vendure/cjk-plugin';

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
    private externalAuthService: ExternalAuthenticationService;
    private connection: TransactionalConnection;
    private channelService: ChannelService;
    private customerService: CustomerService;

    constructor(private options: PhoneAuthPluginOptions) {}

    async init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.smsService = injector.get(SmsService);
        this.externalAuthService = injector.get(ExternalAuthenticationService);
        this.connection = injector.get(TransactionalConnection);
        this.channelService = injector.get(ChannelService);
        this.customerService = injector.get(CustomerService);
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

        // 注：租户凭证覆盖（getAuthOverride）在发码链路（auth.resolver.sendPhoneVerificationCode）生效；
        // authenticate 仅校验验证码，不使用短信凭证。

        const { phoneNumber, code } = data;

        if (!(await this.smsService.verifyCode(phoneNumber, code))) {
            return '验证码错误或已过期';
        }

        try {
            // 1) 健康路径：存在带 Customer 的账号（customer.emailAddress = 手机号）→ 直接返回其 user
            const existing = await this.connection
                .getRepository(ctx, Customer)
                .createQueryBuilder('customer')
                .leftJoinAndSelect('customer.user', 'user')
                .andWhere('customer.emailAddress = :p', { p: phoneNumber })
                .andWhere('user.deletedAt IS NULL')
                .getOne();
            if (existing?.user) {
                // 兼容早期补建的 Customer：phoneNumber 为空则回填手机号
                if (!existing.phoneNumber) {
                    existing.phoneNumber = phoneNumber;
                    await this.connection.getRepository(ctx, Customer).save(existing);
                }
                return existing.user;
            }

            // 2) 历史脏数据修复：早期版本误用 userService.createCustomerUser 只建了 User 没建
            //    Customer（authenticate 成功但 activeCustomer 恒为 null）。此处为存量 User 补建
            //    Customer 实体并关联当前渠道。
            const legacyUser = await this.userService.getUserByEmailAddress(ctx, phoneNumber);
            if (legacyUser) {
                const customer = new Customer({
                    emailAddress: phoneNumber,
                    firstName: phoneNumber,
                    lastName: '',
                    phoneNumber,
                    user: legacyUser,
                });
                await this.channelService.assignToCurrentChannel(customer, ctx);
                await this.connection.getRepository(ctx, Customer).save(customer);
                return legacyUser;
            }

            // 3) 全新建档：createCustomerAndUser 一步创建 User + Customer + 渠道关联（phoneNumber 其后补写）
            const user = await this.externalAuthService.createCustomerAndUser(ctx, {
                strategy: this.name,
                externalIdentifier: phoneNumber,
                emailAddress: phoneNumber,
                firstName: phoneNumber,
                lastName: '',
                verified: true,
            });
            const customer = await this.customerService.findOneByUserId(ctx, user.id);
            if (customer) {
                customer.phoneNumber = phoneNumber;
                await this.connection.getRepository(ctx, Customer).save(customer);
            }
            return user;
        } catch (e: any) {
            Logger.error(`Phone auth failed: ${e.message}`, loggerCtx);
            return false;
        }
    }
}
