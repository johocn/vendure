"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneAuthenticationStrategy = void 0;
const graphql_tag_1 = require("graphql-tag");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const sms_service_1 = require("./sms.service");
class PhoneAuthenticationStrategy {
    constructor(options) {
        this.options = options;
        this.name = 'phone';
        this.smsService = new sms_service_1.SmsService(options);
    }
    async init(injector) {
        this.userService = injector.get(core_1.UserService);
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