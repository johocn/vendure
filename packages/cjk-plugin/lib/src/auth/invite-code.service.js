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
exports.InviteCodeService = exports.INVITE_CODE_BOUND = void 0;
// packages/cjk-plugin/src/auth/invite-code.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
exports.INVITE_CODE_BOUND = 'INVITE_CODE_BOUND';
let InviteCodeService = class InviteCodeService {
    constructor(customerService) {
        this.customerService = customerService;
        this.logger = new common_1.Logger('InviteCodeService');
    }
    /** 本次仅框架:存 inviteCode 到 Customer.customFields,记日志。奖励发放 TODO */
    async bindIfPresent(ctx, customerId, inviteCode) {
        var _a;
        if (!inviteCode)
            return { bound: false, reason: 'no invite code' };
        const customer = await this.customerService.findOne(ctx, customerId);
        if (!customer)
            return { bound: false, reason: 'customer not found' };
        const existing = (_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.inviteCode;
        if (existing)
            return { bound: false, reason: 'already bound' };
        await this.customerService.update(ctx, {
            id: customerId,
            customFields: { inviteCode },
        });
        this.logger.log(`Invite code bound: customer=${customerId}, code=${inviteCode}`);
        return { bound: true };
    }
    async validate(ctx, _inviteCode) {
        // TODO: 后续对接 Strapi 校验邀请码有效性
        return true;
    }
};
exports.InviteCodeService = InviteCodeService;
exports.InviteCodeService = InviteCodeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.CustomerService])
], InviteCodeService);
//# sourceMappingURL=invite-code.service.js.map