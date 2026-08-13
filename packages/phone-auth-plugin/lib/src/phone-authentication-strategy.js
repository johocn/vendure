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
            const user = await this.userService.getUserByEmailAddress(ctx, phoneNumber);
            if (user) {
                return user;
            }
            const result = await this.userService.createCustomerUser(ctx, phoneNumber);
            if ('identifier' in result) {
                return result;
            }
            return false;
        }
        catch (e) {
            core_1.Logger.error(`Phone auth failed: ${e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
}
exports.PhoneAuthenticationStrategy = PhoneAuthenticationStrategy;
//# sourceMappingURL=phone-authentication-strategy.js.map