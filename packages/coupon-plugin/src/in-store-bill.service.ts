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
import { matchesScene } from './coupon-channel';
import { localizeText } from './localize';
import { couponTemplateInScope, resolveRedeemScope } from './redeem-scope';

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

/** 待核销券行（核销页默认列表）：券信息 + 顾客快照 */
export interface PendingInStoreCoupon {
    id: number;
    couponCode: string;
    couponName?: string;
    discountType: string;
    discountValue: number;
    minSpend?: number;
    customerId: number;
    customerName?: string;
    customerPhone?: string;
    issuedAt?: Date | null;
    expiredAt?: Date | null;
}

/** 待核销券查询条件 */
export interface PendingInStoreCouponListOptions {
    skip?: number;
    take?: number;
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
        // 受限核销员（持有 VerifyOrder）：券模板全部关联商品须命中授权配送档案；通用券一律拒绝。
        // 不受限（店主/超管）时 couponTemplateInScope 恒为 true，不产生额外判定开销。
        const scope = await resolveRedeemScope(ctx);
        if (scope.restricted && !(await couponTemplateInScope(ctx, tpl.id, scope))) {
            return { ok: false, reason: IN_STORE_REASON.SCOPE_MISMATCH };
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

    /** 流水列表：按当前渠道强制隔离 + 券码/时间筛选 + 时间倒序分页 */
    async list(
        ctx: RequestContext,
        options?: InStoreBillListOptions,
    ): Promise<{ items: InStoreBill[]; totalItems: number }> {
        const qb = await this.buildBillsQuery(ctx, options);
        qb.orderBy('b.billedAt', 'DESC').addOrderBy('b.id', 'DESC');
        qb.skip(Math.max(0, options?.skip ?? 0)).take(Math.min(options?.take ?? 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    /** 流水汇总：笔数 / 原价合计 / 优惠合计 / 实收合计（金额单位：分） */
    async summary(
        ctx: RequestContext,
        options?: { from?: Date; to?: Date },
    ): Promise<{ count: number; originalTotal: number; discountTotal: number; finalTotal: number }> {
        const qb = await this.buildBillsQuery(ctx, options);
        const raw = await qb
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(b.originalAmount), 0)', 'originalTotal')
            .addSelect('COALESCE(SUM(b.discountAmount), 0)', 'discountTotal')
            .addSelect('COALESCE(SUM(b.finalAmount), 0)', 'finalTotal')
            .getRawOne();
        return {
            count: Number(raw?.count ?? 0),
            originalTotal: Number(raw?.originalTotal ?? 0),
            discountTotal: Number(raw?.discountTotal ?? 0),
            finalTotal: Number(raw?.finalTotal ?? 0),
        };
    }

    /**
     * 待核销券列表（核销页默认展示）：当前渠道下未使用、未过期、场景含 IN_STORE 的券实例。
     * 与 listInStoreCoupons 同一套隔离口径：渠道归属 + 属店（店铺管理员只看本店券/平台券）；
     * 受限核销员（持有 VerifyOrder）必须在分页前完成档案范围过滤（通用券一律不返回），
     * 否则 totalItems 与分页会错位——故取候选集后内存过滤再切片（候选集上限 500 兜底）。
     * 排序：临期优先（无过期时间靠后），便于商户优先处理即将过期的券。
     */
    async listPending(
        ctx: RequestContext,
        options?: PendingInStoreCouponListOptions,
    ): Promise<{ items: PendingInStoreCoupon[]; totalItems: number }> {
        const now = new Date();
        const adminShopId = await this.couponService.resolveShopIdFromActiveUser(ctx, ctx.activeUserId);
        const qb = this.connection
            .getRepository(ctx, CustomerCoupon)
            .createQueryBuilder('cc')
            .leftJoinAndSelect('cc.template', 'tpl')
            .leftJoinAndSelect('tpl.channels', 'tch')
            .where('cc.status = :status', { status: 'UNUSED' })
            .andWhere('tpl.enabled = :enabled', { enabled: true })
            .andWhere('(tpl.usageScene = :sceneStore OR tpl.usageScene = :sceneAll)', {
                sceneStore: 'IN_STORE',
                sceneAll: 'ALL',
            })
            .andWhere('(cc.expiredAt IS NULL OR cc.expiredAt > :now)', { now });
        if (adminShopId != null) {
            qb.andWhere('(tpl.shopId IS NULL OR tpl.shopId = :adminShopId)', { adminShopId });
        }
        qb.orderBy('CASE WHEN cc.expiredAt IS NULL THEN 1 ELSE 0 END', 'ASC')
            .addOrderBy('cc.expiredAt', 'ASC')
            .addOrderBy('cc.id', 'DESC')
            // 候选集固定上限（内存过滤/分页在候选集上进行），与受限核销员分页前过滤口径一致
            .take(500);
        const candidates = await qb.getMany();
        // 渠道归属过滤（channels 为空 = 不限渠道）
        const base = candidates.filter(cc => {
            const tpl = cc.template;
            return !!tpl && matchesScene(tpl.usageScene, 'IN_STORE') && this.couponService.templateBelongsToChannel(ctx, tpl);
        });
        // 受限核销员：档案范围过滤（逐模板判定并缓存，通用券一律不返回）
        const scope = await resolveRedeemScope(ctx);
        let filtered = base;
        if (scope.restricted) {
            const scopeCache = new Map<number, boolean>();
            filtered = [];
            for (const cc of base) {
                const tpl = cc.template!;
                let hit = scopeCache.get(tpl.id as number);
                if (hit == null) {
                    hit = await couponTemplateInScope(ctx, tpl.id, scope);
                    scopeCache.set(tpl.id as number, hit);
                }
                if (hit) filtered.push(cc);
            }
        }
        const skip = Math.max(0, options?.skip ?? 0);
        const take = Math.min(Math.max(1, options?.take ?? 20), 200);
        const page = filtered.slice(skip, skip + take);
        const items: PendingInStoreCoupon[] = [];
        for (const cc of page) {
            const tpl = cc.template!;
            const info = await this.loadCustomerInfo(ctx, cc.customerId);
            items.push({
                id: cc.id as number,
                couponCode: cc.code,
                couponName: localizeText(tpl.name, ctx.languageCode),
                discountType: tpl.type,
                discountValue: tpl.discountValue,
                minSpend: tpl.minSpend ?? 0,
                customerId: cc.customerId,
                customerName: info.name,
                customerPhone: info.phone,
                issuedAt: cc.issuedAt ?? null,
                expiredAt: cc.expiredAt ?? null,
            });
        }
        return { items, totalItems: filtered.length };
    }

    /**
     * 流水查询基座：渠道隔离 + 可选筛选（list / summary 共用）。
     * 受限核销员（持有 VerifyOrder）只能看到自己的核销流水；店主/超管不受限。
     */
    private async buildBillsQuery(ctx: RequestContext, options?: InStoreBillListOptions & { take?: number }) {
        const qb = this.connection
            .getRepository(ctx, InStoreBill)
            .createQueryBuilder('b')
            .where('b.channelId = :channelId', { channelId: Number(ctx.channelId) });
        const scope = await resolveRedeemScope(ctx);
        if (scope.restricted && ctx.activeUserId != null) {
            qb.andWhere('b.operatorId = :operatorId', { operatorId: Number(ctx.activeUserId) });
        }
        if (options?.couponCode) {
            qb.andWhere('b.couponCode = :code', { code: options.couponCode.trim() });
        }
        if (options?.from) {
            qb.andWhere('b.billedAt >= :from', { from: options.from });
        }
        if (options?.to) {
            qb.andWhere('b.billedAt <= :to', { to: options.to });
        }
        return qb;
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
