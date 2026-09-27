// packages/cjk-plugin/src/auth/invite-code.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, CustomerService } from '@vendure/core';

export const INVITE_CODE_BOUND = 'INVITE_CODE_BOUND';

export interface BindResult {
    bound: boolean;
    reason?: string;
}

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
@Injectable()
export class InviteCodeService {
    private readonly logger = new Logger('InviteCodeService');
    constructor(private customerService: CustomerService) {}

    /** 首次登录带邀请码时落库快照（已存在则不覆盖，保留首次归属）；有效性由 SSO 侧保证 */
    async bindIfPresent(ctx: RequestContext, customerId: string, inviteCode: string): Promise<BindResult> {
        if (!inviteCode) return { bound: false, reason: 'no invite code' };
        const customer = await this.customerService.findOne(ctx, customerId as any);
        if (!customer) return { bound: false, reason: 'customer not found' };
        const existing = (customer as any).customFields?.inviteCode;
        if (existing) return { bound: false, reason: 'already bound' };
        await this.customerService.update(ctx, {
            id: customerId as any,
            customFields: { inviteCode },
        });
        this.logger.log(`Invite code bound: customer=${customerId}, code=${inviteCode}`);
        return { bound: true };
    }
}
