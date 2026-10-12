"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneAuthenticationStrategy = void 0;
const graphql_tag_1 = require("graphql-tag");
const core_1 = require("@vendure/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const constants_1 = require("./constants");
const sms_service_1 = require("./sms.service");
class PhoneAuthenticationStrategy {
    constructor(options) {
        this.options = options;
        this.name = 'phone';
    }
    async init(injector) {
        this.userService = injector.get(core_1.UserService);
        this.smsService = injector.get(sms_service_1.SmsService);
        this.externalAuthService = injector.get(core_1.ExternalAuthenticationService);
        this.connection = injector.get(core_1.TransactionalConnection);
        this.channelService = injector.get(core_1.ChannelService);
        this.customerService = injector.get(core_1.CustomerService);
    }
    defineInputType() {
        return (0, graphql_tag_1.gql) `
            input PhoneAuthInput {
                phoneNumber: String!
                code: String!
            }
        `;
    }
    async authenticate(ctx, data) {
        // 租户级登录方式开关检查（"未启用"属权限错误，抛 ForbiddenError）
        if (!(0, cjk_plugin_1.isAuthMethodEnabled)(ctx, 'phone')) {
            throw new core_1.ForbiddenError();
        }
        // 租户凭证覆盖（已解密；无覆盖则回退 this.options；当前策略 authenticate 仅校验 code，凭证由 SmsService 在发码时使用）
        const override = (0, cjk_plugin_1.getAuthOverride)(ctx, 'phone');
        const accessKeyId = (override === null || override === void 0 ? void 0 : override.accessKeyId) || this.options.accessKeyId;
        const accessKeySecret = (override === null || override === void 0 ? void 0 : override.accessKeySecret) || this.options.accessKeySecret;
        const signName = (override === null || override === void 0 ? void 0 : override.signName) || this.options.signName;
        const templateCode = (override === null || override === void 0 ? void 0 : override.templateCode) || this.options.templateCode;
        const { phoneNumber, code } = data;
        if (!this.smsService.verifyCode(phoneNumber, code)) {
            return '验证码错误或已过期';
        }
        try {
            // 1) 健康路径：存在带 Customer 的账号（customer.emailAddress = 手机号）→ 直接返回其 user
            const existing = await this.connection
                .getRepository(ctx, core_1.Customer)
                .createQueryBuilder('customer')
                .leftJoinAndSelect('customer.user', 'user')
                .andWhere('customer.emailAddress = :p', { p: phoneNumber })
                .andWhere('user.deletedAt IS NULL')
                .getOne();
            if (existing === null || existing === void 0 ? void 0 : existing.user) {
                // 兼容早期补建的 Customer：phoneNumber 为空则回填手机号
                if (!existing.phoneNumber) {
                    existing.phoneNumber = phoneNumber;
                    await this.connection.getRepository(ctx, core_1.Customer).save(existing);
                }
                return existing.user;
            }
            // 2) 历史脏数据修复：早期版本误用 userService.createCustomerUser 只建了 User 没建
            //    Customer（authenticate 成功但 activeCustomer 恒为 null）。此处为存量 User 补建
            //    Customer 实体并关联当前渠道。
            const legacyUser = await this.userService.getUserByEmailAddress(ctx, phoneNumber);
            if (legacyUser) {
                const customer = new core_1.Customer({
                    emailAddress: phoneNumber,
                    firstName: phoneNumber,
                    lastName: '',
                    phoneNumber,
                    user: legacyUser,
                });
                await this.channelService.assignToCurrentChannel(customer, ctx);
                await this.connection.getRepository(ctx, core_1.Customer).save(customer);
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
                await this.connection.getRepository(ctx, core_1.Customer).save(customer);
            }
            return user;
        }
        catch (e) {
            core_1.Logger.error(`Phone auth failed: ${e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
}
exports.PhoneAuthenticationStrategy = PhoneAuthenticationStrategy;
//# sourceMappingURL=phone-authentication-strategy.js.map