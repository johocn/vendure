/**
 * 到店核销范围（受限核销员）适配器。
 *
 * 依赖方向为 cjk-plugin → coupon-plugin（反向会成环），而「受限核销员」的判定数据
 * （TenantMember 配送档案白名单、变体 shippingProfileId）都在 cjk-plugin 侧。
 * 故此处只定义契约与注册入口，由 cjk-plugin 在启动时注入实现。
 *
 * 未注册实现时一律返回「不受限 / 命中」，保证 coupon-plugin 既有行为与单测不变。
 */
import { ID, Permission, RequestContext } from '@vendure/core';

/** 单一来源：cjk-plugin tenant-permissions.ts 的 VerifyOrder；此处用字面量避免反向依赖 */
export const VERIFY_ORDER_PERMISSION = 'VerifyOrder' as Permission;

export interface RedeemScope {
    /** 是否为受限核销员（持有 VerifyOrder） */
    restricted: boolean;
    /** 可核销的配送档案白名单（ShippingProfile.id）；受限且为空 = 默认拒绝 */
    shippingProfileIds: string[];
}

export interface RedeemScopeProvider {
    /** 解析当前登录人在当前租户下的核销范围 */
    resolve(ctx: RequestContext): Promise<RedeemScope>;
    /** 订单侧：订单全部行的配送档案是否命中白名单（scope 已由调用方解析） */
    orderInScope(ctx: RequestContext, orderId: ID, scope: RedeemScope): Promise<boolean>;
    /** 券侧：券模板全部关联商品/变体的档案是否命中白名单（scope 已由调用方解析） */
    couponTemplateInScope(ctx: RequestContext, templateId: ID, scope: RedeemScope): Promise<boolean>;
}

let provider: RedeemScopeProvider | null = null;

export function setRedeemScopeResolver(p: RedeemScopeProvider | null): void {
    provider = p;
}

export async function resolveRedeemScope(ctx: RequestContext): Promise<RedeemScope> {
    if (!provider) return { restricted: false, shippingProfileIds: [] };
    return provider.resolve(ctx);
}

export async function orderInScope(
    ctx: RequestContext,
    orderId: ID,
    scope?: RedeemScope,
): Promise<boolean> {
    if (!provider) return true;
    const s = scope ?? (await provider.resolve(ctx));
    if (!s.restricted) return true;
    return provider.orderInScope(ctx, orderId, s);
}

export async function couponTemplateInScope(
    ctx: RequestContext,
    templateId: ID,
    scope?: RedeemScope,
): Promise<boolean> {
    if (!provider) return true;
    const s = scope ?? (await provider.resolve(ctx));
    if (!s.restricted) return true;
    return provider.couponTemplateInScope(ctx, templateId, s);
}