import { Injectable } from '@nestjs/common';
import {
    Administrator,
    ID,
    Order,
    ProductVariant,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';
import {
    ProductCouponBinding,
    RedeemScope,
    RedeemScopeProvider,
    VERIFY_ORDER_PERMISSION,
} from '@vendure/coupon-plugin';

import { TenantMember } from './tenant-member.entity';

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
@Injectable()
export class RedeemScopeService implements RedeemScopeProvider {
    constructor(private connection: TransactionalConnection) {}

    async resolve(ctx: RequestContext): Promise<RedeemScope> {
        if (!ctx.userHasPermissions([VERIFY_ORDER_PERMISSION])) {
            return { restricted: false, shippingProfileIds: [] };
        }
        const member = await this.findMember(ctx);
        return {
            restricted: true,
            shippingProfileIds: (member?.shippingProfileIds ?? []).map(String),
        };
    }

    /** 订单侧：订单所有商品行的档案都须落在白名单内；任一行缺失或越界即拒绝 */
    async orderInScope(ctx: RequestContext, orderId: ID, scope: RedeemScope): Promise<boolean> {
        if (!scope.restricted) {
            return true;
        }
        const allow = new Set(scope.shippingProfileIds.map(String));
        if (allow.size === 0) {
            return false;
        }
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: Number(orderId) },
            relations: { lines: { productVariant: true } },
        });
        if (!order || !order.lines?.length) {
            return false;
        }
        return order.lines.every(line => {
            const profileId = (line.productVariant?.customFields as any)?.shippingProfileId;
            return profileId != null && allow.has(String(profileId));
        });
    }

    /** 券侧：券模板须有绑定记录，且所有绑定关联商品/变体的档案都落在白名单内；通用券一律拒绝 */
    async couponTemplateInScope(
        ctx: RequestContext,
        templateId: ID,
        scope: RedeemScope,
    ): Promise<boolean> {
        if (!scope.restricted) {
            return true;
        }
        const allow = new Set(scope.shippingProfileIds.map(String));
        if (allow.size === 0) {
            return false;
        }
        const bindings = await this.connection.getRepository(ctx, ProductCouponBinding).find({
            where: { couponTemplateId: Number(templateId) },
        });
        if (bindings.length === 0) {
            return false;
        }
        const variantIds: number[] = [];
        for (const binding of bindings) {
            const ids = await this.resolveBindingVariantIds(ctx, binding);
            if (ids.length === 0) {
                return false;
            }
            variantIds.push(...ids);
        }
        if (variantIds.length === 0) {
            return false;
        }
        const variants = await this.connection.getRepository(ctx, ProductVariant).find({
            where: { id: In(variantIds) },
        });
        const profileByVariant = new Map<number, string | null>(
            variants.map(v => [Number(v.id), ((v.customFields as any)?.shippingProfileId ?? null) as string | null]),
        );
        return variantIds.every(id => {
            const profileId = profileByVariant.get(id);
            return profileId != null && allow.has(String(profileId));
        });
    }

    /** 绑定未细化 variantIds 时，取该商品的全部变体 */
    private async resolveBindingVariantIds(
        ctx: RequestContext,
        binding: ProductCouponBinding,
    ): Promise<number[]> {
        if (binding.variantIds?.length) {
            return binding.variantIds.map(Number);
        }
        const variants = await this.connection.getRepository(ctx, ProductVariant).find({
            where: { product: { id: binding.productId } } as any,
            select: { id: true },
        });
        return variants.map(v => Number(v.id));
    }

    /** 当前登录人 × 当前租户的人员记录（channelId = 登录租户） */
    private async findMember(ctx: RequestContext): Promise<TenantMember | null> {
        const userId = ctx.activeUserId;
        if (userId == null) {
            return null;
        }
        const admin = await this.connection.getRepository(ctx, Administrator).findOne({
            where: { user: { id: userId } } as any,
            select: { id: true },
        });
        if (!admin) {
            return null;
        }
        return this.connection.getRepository(ctx, TenantMember).findOne({
            where: { administratorId: String(admin.id), channelId: String(ctx.channelId) },
        });
    }
}