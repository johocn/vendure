import { RequestContext, CustomerService } from '@vendure/core';
export declare const INVITE_CODE_BOUND = "INVITE_CODE_BOUND";
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
export declare class InviteCodeService {
    private customerService;
    private readonly logger;
    constructor(customerService: CustomerService);
    /** 首次登录带邀请码时落库快照（已存在则不覆盖，保留首次归属）；有效性由 SSO 侧保证 */
    bindIfPresent(ctx: RequestContext, customerId: string, inviteCode: string): Promise<BindResult>;
}
