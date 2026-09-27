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
/**
 * 邀请码「对账快照」服务（G5 落档：权威不在 Vendure）。
 *
 * 邀请码的有效性校验、分销关系建立、使用次数计数与奖励发放，全部由 Strapi / zhao-sso 侧闭环
 * （`sso_invite_codes.use_count` / `sso_invite_usages` / `sso_referral_relations`、
 *  `buildReferralRelation`：校验邀请码 → 防自邀 → 计算层级 → 事务写入）。
 *
 * Vendure 这边只做一件事：把登录时带过来的 inviteCode 落到 `Customer.customFields.inviteCode`
 * 作为对账快照（登录链路见 `sso-authentication-strategy.ts`）。因此本服务**不做**有效性校验，
 * 也**不**在这里发奖 —— 需要判断邀请码是否有效 / 是否已发奖时，请查 SSO 侧数据，不要依赖本表。
 */
let InviteCodeService = class InviteCodeService {
    constructor(customerService) {
        this.customerService = customerService;
        this.logger = new common_1.Logger('InviteCodeService');
    }
    /** 首次登录带邀请码时落库快照（已存在则不覆盖，保留首次归属）；有效性由 SSO 侧保证 */
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
};
exports.InviteCodeService = InviteCodeService;
exports.InviteCodeService = InviteCodeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.CustomerService])
], InviteCodeService);
//# sourceMappingURL=invite-code.service.js.map