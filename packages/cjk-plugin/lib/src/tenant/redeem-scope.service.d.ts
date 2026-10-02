import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { RedeemScope, RedeemScopeProvider } from '@vendure/coupon-plugin';
/**
 * 到店核销范围判定（受限核销员 = 持有 VerifyOrder 权限）。
 *
 * 判定链见 spec §3：
 *   不受限 → 全量；受限 → 读 TenantMember.shippingProfileIds，
 *   空白名单 = 默认拒绝；非空则要求「全部命中」（订单所有行 / 券模板所有关联商品）。
 *
 * 本服务在插件 onApplicationBootstrap 中经 setRedeemScopeResolver 注册给 coupon-plugin
 * （依赖方向 cjk → coupon，避免成环）。
 */
export declare class RedeemScopeService implements RedeemScopeProvider {
    private connection;
    constructor(connection: TransactionalConnection);
    resolve(ctx: RequestContext): Promise<RedeemScope>;
    /** 订单侧：订单所有商品行的档案都须落在白名单内；任一行缺失或越界即拒绝 */
    orderInScope(ctx: RequestContext, orderId: ID, scope: RedeemScope): Promise<boolean>;
    /** 券侧：券模板须有绑定记录，且所有绑定关联商品/变体的档案都落在白名单内；通用券一律拒绝 */
    couponTemplateInScope(ctx: RequestContext, templateId: ID, scope: RedeemScope): Promise<boolean>;
    /** 绑定未细化 variantIds 时，取该商品的全部变体 */
    private resolveBindingVariantIds;
    /** 当前登录人 × 当前租户的人员记录（channelId = 登录租户） */
    private findMember;
}
