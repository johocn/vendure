"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneAuthenticationStrategy = void 0;
const graphql_tag_1 = require("graphql-tag");
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const sms_service_1 = require("./sms.service");
let PhoneAuthenticationStrategy = class PhoneAuthenticationStrategy {
    constructor(smsService, userService) {
        this.smsService = smsService;
        this.userService = userService;
        this.name = 'phone';
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
};
exports.PhoneAuthenticationStrategy = PhoneAuthenticationStrategy;
exports.PhoneAuthenticationStrategy = PhoneAuthenticationStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sms_service_1.SmsService,
        core_2.UserService])
], PhoneAuthenticationStrategy);
//# sourceMappingURL=phone-authentication-strategy.js.map