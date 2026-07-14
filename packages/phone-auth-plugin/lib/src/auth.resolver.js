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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneAuthResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const sms_service_1 = require("./sms.service");
let PhoneAuthResolver = class PhoneAuthResolver {
    constructor(options, smsService, customerService) {
        this.options = options;
        this.smsService = smsService;
        this.customerService = customerService;
    }
    async sendPhoneVerificationCode(phoneNumber) {
        return this.smsService.sendVerificationCode(phoneNumber);
    }
    async registerCustomer(ctx, args) {
        const { phoneNumber, code, password } = args.input;
        const verified = this.smsService.verifyCode(phoneNumber, code);
        if (!verified) {
            throw new core_1.UserInputError('验证码错误或已过期');
        }
        const result = await this.customerService.registerCustomerAccount(ctx, {
            emailAddress: phoneNumber,
            password,
            phoneNumber,
        });
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            if (result.errorCode === 'EMAIL_ADDRESS_CONFLICT_ERROR') {
                return { success: true };
            }
            throw new core_1.UserInputError(result.message || '注册失败');
        }
        return { success: true };
    }
};
exports.PhoneAuthResolver = PhoneAuthResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, graphql_1.Args)('phoneNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PhoneAuthResolver.prototype, "sendPhoneVerificationCode", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PhoneAuthResolver.prototype, "registerCustomer", null);
exports.PhoneAuthResolver = PhoneAuthResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(constants_1.PHONE_AUTH_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, sms_service_1.SmsService,
        core_1.CustomerService])
], PhoneAuthResolver);
//# sourceMappingURL=auth.resolver.js.map