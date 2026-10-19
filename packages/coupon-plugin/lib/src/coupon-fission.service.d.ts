import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { CouponFissionRecord } from './coupon-fission-record.entity';
import { CouponFissionView } from './coupon-fission';
/**
 * 分享裂变（FR-C）服务：
 * - fissionActivity：匿名可查活动视图（含奖励券模板摘要）
 * - claimReward：登录后领取裂变奖励（幂等 + 四例外 + 事务化，R1/R2/R3）
 */
export declare class CouponFissionService {
    private connection;
    private couponService;
    constructor(connection: TransactionalConnection, couponService: CouponService);
    /** 渠道 couponFission 配置原文 */
    private loadRawConfig;
    /** 活动视图（匿名可查）：返回 null 表示无生效活动（前端不渲染/落页仅展示券店）。 */
    fissionActivity(ctx: RequestContext): Promise<CouponFissionView<CouponTemplate> | null>;
    /**
     * 领取裂变奖励（登录用户，以邀请码定位分享者）。
     * 返回 status：
     * - OK：发券成功（双方或单方，看 inviterCoupon）
     * - ALREADY_REWARDED：同被分享者同活动已领过（幂等，R3）
     * - SELF_SHARE：自分享不发奖
     * - BLOCKED_NEW_CUSTOMER：活动限新客且被分享者非新客（记档不再重试）
     * - SOLD_OUT：奖励券余量耗尽（R2，可重试但通常稳定失败）
     * - NOT_LOGGED_IN / NO_INVITER / INACTIVE：登录/邀请码/活动窗口问题（服务端已兜底，前端仍需各自引导）
     */
    claimReward(ctx: RequestContext, inviteCode: string): Promise<{
        status: string;
        inviteeCoupon: CustomerCoupon | null;
        inviterCoupon: CustomerCoupon | null;
    }>;
    /** 事务内执行发奖主体（withTransaction 回调；所有读写必须走传入的 txCtx）。 */
    private claimRewardInTransaction;
    /** 已有记录 → 结果映射（幂等重入） */
    private mapExisting;
    /** 发放单侧奖励：原子扣发行余量 + 建券（issuedBy=FISSION 留痕）。售罄/失败返回 null（事务内不产生半写）。 */
    private issueRewardInTx;
    /** 裂变记录列表（管理端核对渠道留痕，R1） */
    listFissionRecords(ctx: RequestContext, take?: number): Promise<CouponFissionRecord[]>;
}
