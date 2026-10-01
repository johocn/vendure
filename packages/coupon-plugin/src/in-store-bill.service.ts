import { Injectable } from '@nestjs/common';
import {
    Administrator,
    Customer,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { InStoreBill } from './in-store-bill.entity';
import {
    IN_STORE_REASON,
    IN_STORE_REASON_MESSAGES,
    InStoreReason,
    computeInStoreBill,
} from './in-store-bill';
import { localizeText } from './localize';

/** 核销表单试算返回（金额单位：分；originalAmount 省略时金额字段为 null，仅回券信息） */
export interface InStoreBillQuote {
    ok: boolean;
    reason?: string | null;
    couponCode?: string | null;
    couponName?: string | null;
    discountType?: string | null;
    discountValue?: number | null;
    minSpend?: number | null;
    originalAmount?: number | null;
    discountAmount?: number | null;
    finalAmount?: number | null;
    customerName?: string | null;
    customerPhone?: string | null;
    expiresAt?: Date | null;
}

/** 流水查询条件 */
export interface InStoreBillListOptions {
    skip?: number;
    take?: number;
    couponCode?: string;
    from?: Date;
    to?: Date;
}

type LocateResult =
    | { ok: true; cc: CustomerCoupon; tpl: CouponTemplate }
    | { ok: false; reason: InStoreReason };

@Injectable()
export class InStoreBillService {
    constructor(
        private connection: TransactionalConnection,
        private couponService: CouponService,
    ) {}

    /**
     * 券码 → 可用到店买单券（校验顺序见 spec §7）：
     * 存在 → 模板启用 → 未使用 → 未过期 → 场景含 IN_STORE → 渠道归属 → 属店权限。
     * 失败不抛错，返回原因码（quote 用；redeem 再转为 UserInputError）。
     */
    private async locate(ctx: RequestContext, code: string): Promise<LocateResult> {
        const trimmed = (code ?? '').trim();
        if (!trimmed) {
            return { ok: false, reason: IN_STORE_REASON.COUPON_NOT_FOUND };
        }
        const cc = await this.connection.getRepository(ctx, CustomerCoupon).findOne({
            where: { code: trimmed },
            relations: { template: { channels: true } },
        });
        if (!cc) {
            return { ok: false, reason: IN_STORE_REASON.COUPON_NOT_FOUND };
        }
        const tpl = cc.template;
        if (!tpl || !tpl.enabled) {
            return { ok: false, reason: IN_STORE_REASON.TEMPLATE_DISABLED };
        }
        if (cc.status !== 'UNUSED') {
            return { ok: false, reason: IN_STORE_REASON.COUPON_NOT_UNUSED };
        }
        if (cc.expiredAt && new Date(cc.expiredAt).getTime() <= Date.now()) {
            return { ok: false, reason: IN_STORE_REASON.COUPON_EXPIRED };
        }
        const scene = tpl.usageScene ?? 'ONLINE';
        if (scene !== 'IN_STORE' && scene !== 'ALL') {
            return { ok: false, reason: IN_STORE_REASON.SCENE_MISMATCH };
        }
        if (!this.couponService.templateBelongsToChannel(ctx, tpl)) {
            return { ok: false, reason: IN_STORE_REASON.TENANT_MISMATCH };
        }
        try {
            await this.couponService.assertManagedByShop(ctx, tpl.shopId);
        } catch {
            return { ok: false, reason: IN_STORE_REASON.TENANT_MISMATCH };
        }
        return { ok: true, cc, tpl };
    }

    /** 核销表单试算：originalAmount 省略 → 仅回券信息；否则回试算金额 */
    async quote(
        ctx: RequestContext,
        code: string,
        originalAmount?: number | null,
    ): Promise<InStoreBillQuote> {
        const located = await this.locate(ctx, code);
        if (!located.ok) {
            return { ok: false, reason: located.reason };
        }
        const { cc, tpl } = located;
        const info = await this.loadCustomerInfo(ctx, cc.customerId);
        const base: InStoreBillQuote = {
            ok: true,
            reason: null,
            couponCode: cc.code,
            couponName: localizeText(tpl.name, ctx.languageCode),
            discountType: tpl.type,
            discountValue: tpl.discountValue,
            minSpend: tpl.minSpend ?? 0,
            customerName: info.name ?? null,
            customerPhone: info.phone ?? null,
            expiresAt: cc.expiredAt ?? null,
            originalAmount: null,
            discountAmount: null,
            finalAmount: null,
        };
        if (originalAmount == null) {
            return base;
        }
        const computed = computeInStoreBill(tpl, originalAmount);
        if (!computed.ok) {
            // 保留券信息，便于页面同时展示券卡与金额校验提示
            return { ...base, ok: false, reason: computed.reason };
        }
        return {
            ...base,
            originalAmount: computed.originalAmount,
            discountAmount: computed.discountAmount,
            finalAmount: computed.finalAmount,
        };
    }

    /**
     * 到店买单核销：校验 → 原子占用（仅 UNUSED 可置 USED）→ 写流水。
     * 需在 @Transaction() 内调用。
     */
    async redeem(
        ctx: RequestContext,
        code: string,
        originalAmount: number,
        remark?: string,
    ): Promise<InStoreBill> {
        const located = await this.locate(ctx, code);
        if (!located.ok) {
            throw new UserInputError(IN_STORE_REASON_MESSAGES[located.reason]);
        }
        const { cc, tpl } = located;
        const computed = computeInStoreBill(tpl, originalAmount);
        if (!computed.ok) {
            throw new UserInputError(IN_STORE_REASON_MESSAGES[computed.reason]);
        }
        // 并发防护：状态条件更新，affectedRows=0 说明已被其它请求核销
        const consume = await this.connection
            .getRepository(ctx, CustomerCoupon)
            .createQueryBuilder()
            .update()
            .set({ status: 'USED', usedAt: new Date() })
            .where('id = :id AND status = :unused', { id: cc.id, unused: 'UNUSED' })
            .execute();
        if ((consume.affected ?? 0) === 0) {
            throw new UserInputError(IN_STORE_REASON_MESSAGES[IN_STORE_REASON.COUPON_NOT_UNUSED]);
        }

        const info = await this.loadCustomerInfo(ctx, cc.customerId);
        const operatorName = await this.resolveOperatorName(ctx);
        const bill = new InStoreBill({
            channelId: ctx.channelId,
            customerCouponId: cc.id as number,
            couponCode: cc.code,
            couponTemplateId: tpl.id as number,
            couponName: localizeText(tpl.name, ctx.languageCode),
            customerId: cc.customerId,
            customerName: info.name,
            customerPhone: info.phone,
            discountType: tpl.type,
            discountValue: tpl.discountValue,
            originalAmount: computed.originalAmount,
            discountAmount: computed.discountAmount,
            finalAmount: computed.finalAmount,
            operatorId: ctx.activeUserId as number,
            operatorName,
            remark: remark?.trim() || undefined,
            billedAt: new Date(),
        });
        return this.connection.getRepository(ctx, InStoreBill).save(bill);
    }

    /** 顾客姓名/手机号快照（查询失败不阻断核销） */
    private async loadCustomerInfo(
        ctx: RequestContext,
        customerId: number,
    ): Promise<{ name?: string; phone?: string }> {
        try {
            const c = await this.connection.getRepository(ctx, Customer).findOne({
                where: { id: customerId } as any,
            });
            if (!c) return {};
            const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.emailAddress || undefined;
            return { name, phone: c.phoneNumber ?? undefined };
        } catch {
            return {};
        }
    }

    /** 核销人名称快照（查询失败不阻断核销） */
    private async resolveOperatorName(ctx: RequestContext): Promise<string | undefined> {
        try {
            const admin = await this.connection.getRepository(ctx, Administrator).findOne({
                where: { user: { id: ctx.activeUserId } } as any,
            });
            if (!admin) return undefined;
            return [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.emailAddress || undefined;
        } catch {
            return undefined;
        }
    }
}
