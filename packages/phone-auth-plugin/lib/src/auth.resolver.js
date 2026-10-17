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
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const constants_1 = require("./constants");
const sms_service_1 = require("./sms.service");
/** 大陆手机号格式 */
const PHONE_NUMBER_RE = /^1[3-9]\d{9}$/;
let PhoneAuthResolver = class PhoneAuthResolver {
    constructor(options, smsService, customerService, userService) {
        this.options = options;
        this.smsService = smsService;
        this.customerService = customerService;
        this.userService = userService;
    }
    async sendPhoneVerificationCode(ctx, phoneNumber) {
        // 租户级登录方式开关（未启用即权限错误）
        if (!(0, cjk_plugin_1.isAuthMethodEnabled)(ctx, 'phone')) {
            throw new core_1.ForbiddenError();
        }
        if (!PHONE_NUMBER_RE.test(phoneNumber)) {
            throw new core_1.UserInputError('手机号格式不正确');
        }
        // 发送频率限制：60s 冷却 + 同号每日上限（防短信轰炸/费用消耗）
        const limited = await this.smsService.checkRateLimit(phoneNumber);
        if (limited) {
            return false;
        }
        // 租户级凭证覆盖（已解密）：租户自行配置的阿里云凭证/签名/模板优先于全局 options
        const override = (0, cjk_plugin_1.getAuthOverride)(ctx, 'phone');
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
    async registerCustomer(ctx, args) {
        const { phoneNumber, code, password, emailAddress } = args.input;
        // 分派：手机号注册 or 邮箱注册（二选一）
        const isPhoneMode = !!phoneNumber;
        const isEmailMode = !!emailAddress && !phoneNumber;
        if (!isPhoneMode && !isEmailMode) {
            throw new core_1.UserInputError('必须提供 phoneNumber 或 emailAddress 之一');
        }
        let identifier;
        let resolvedPhone;
        if (isPhoneMode) {
            if (!PHONE_NUMBER_RE.test(phoneNumber)) {
                throw new core_1.UserInputError('手机号格式不正确');
            }
            if (!code) {
                throw new core_1.UserInputError('手机号注册必须提供验证码');
            }
            // verifyCode 是 async：漏 await 会得到恒真值的 Promise，令校验失效
            const verified = await this.smsService.verifyCode(phoneNumber, code);
            if (!verified) {
                throw new core_1.UserInputError('验证码错误或已过期');
            }
            identifier = phoneNumber;
            resolvedPhone = phoneNumber;
            // 手机号作为 identifier 存储（非邮箱格式不会被 normalize 转小写）
        }
        else {
            identifier = emailAddress;
        }
        const result = await this.customerService.registerCustomerAccount(ctx, {
            emailAddress: identifier,
            password,
            phoneNumber: resolvedPhone,
        });
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            if (result.errorCode === 'EMAIL_ADDRESS_CONFLICT_ERROR') {
                // 防账户枚举：已存在时返回 success
                return { success: true };
            }
            throw new core_1.UserInputError(result.message || '注册失败');
        }
        return { success: true };
    }
    async resetPasswordWithPhoneCode(ctx, phoneNumber, code, newPassword) {
        // 租户级登录方式开关（未启用即权限错误）
        if (!(0, cjk_plugin_1.isAuthMethodEnabled)(ctx, 'phone')) {
            throw new core_1.ForbiddenError();
        }
        if (!PHONE_NUMBER_RE.test(phoneNumber)) {
            throw new core_1.UserInputError('手机号格式不正确');
        }
        // verifyCode 是 async：漏 await 会得到恒真值的 Promise，令校验失效（同 registerCustomer）
        const verified = await this.smsService.verifyCode(phoneNumber, code);
        if (!verified) {
            throw new core_1.UserInputError('验证码错误或已过期');
        }
        // 手机注册用户 identifier=手机号（见 registerCustomer 注释）；
        // getUserByEmailAddress 对非邮箱格式（无 @）按 identifier 精确匹配，不做小写归一
        const user = await this.userService.getUserByEmailAddress(ctx, phoneNumber);
        if (!user) {
            throw new core_1.UserInputError('账号不存在');
        }
        // 本 fork 的 UserService 无 setPassword(ctx, userId, ...)，设置密码用 setNativePassword(ctx, user, pwd)；
        // 其要求 authenticationMethods 已加载，getUserByEmailAddress 已 leftJoinAndSelect 该关系
        const result = await this.userService.setNativePassword(ctx, user, newPassword);
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            // PasswordValidationError.message 是常量错误码，友好文案在 validationErrorMessage
            throw new core_1.UserInputError(result.validationErrorMessage || result.message || '密码不符合要求');
        }
        return true;
    }
};
exports.PhoneAuthResolver = PhoneAuthResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('phoneNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
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
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('phoneNumber')),
    __param(2, (0, graphql_1.Args)('code')),
    __param(3, (0, graphql_1.Args)('newPassword')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, String]),
    __metadata("design:returntype", Promise)
], PhoneAuthResolver.prototype, "resetPasswordWithPhoneCode", null);
exports.PhoneAuthResolver = PhoneAuthResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(constants_1.PHONE_AUTH_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, sms_service_1.SmsService,
        core_1.CustomerService,
        core_1.UserService])
], PhoneAuthResolver);
//# sourceMappingURL=auth.resolver.js.map