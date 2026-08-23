import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { PaymentProfileService } from './payment-profile.service';

@Resolver()
export class PaymentProfileShopResolver {
    constructor(private service: PaymentProfileService) {}

    @Query()
    async eligiblePaymentMethodsByProfile(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        const intersected = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        if (intersected.length === 0) return [];
        return this.service.findPaymentMethodsByIds(ctx, intersected.map(m => m.id));
    }

    @Query()
    async eligibleInstallmentOptions(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        return this.service.getIntersectedInstallmentOptions(ctx, profileIds);
    }

    @Query()
    async checkPaymentProfileCompatibility(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        const methods = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        return {
            compatible: methods.length > 0,
            intersectedCount: methods.length,
        };
    }

    @Query()
    async eligiblePaymentMethodsWithConfig(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        const intersected = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        if (intersected.length === 0) return [];
        const configs = new Map<ID, any>();
        for (const pid of profileIds) {
            const rows = await this.service.getMethodConfigsByProfile(ctx, pid);
            for (const r of rows) configs.set(r.paymentMethodId as any, r);
        }
        const full = await this.service.findPaymentMethodsByIds(ctx, intersected.map(m => m.id));
        return full.map((m: any) => {
            const cfg = configs.get(m.id);
            const options = cfg?.mode === 'installment' ? cfg.options ?? null : null;
            return { id: m.id, code: m.code, mode: cfg?.mode ?? 'installment', options, name: m.translations?.[0]?.name ?? m.code };
        });
    }

    @Query()
    async resolvePaymentMethodsForChannel(@Ctx() ctx: RequestContext) {
        const def = await this.service.getTenantDefault(ctx);
        if (def) {
            const ids = (def.paymentMethods ?? []).map(m => m.id);
            const full = await this.service.findPaymentMethodsByIds(ctx, ids);
            const configs = await this.service.getMethodConfigsByProfile(ctx, def.id as any);
            const cm = new Map(configs.map(c => [String(c.paymentMethodId), c]));
            return full.map((m: any) => {
                const cfg = cm.get(String(m.id));
                const options = cfg?.mode === 'installment' ? cfg.options ?? null : null;
                return { id: m.id, code: m.code, mode: cfg?.mode ?? 'installment', options, name: m.translations?.[0]?.name ?? m.code };
            });
        }
        // 无默认档案 → 返回当前可见的全部支付方式（沿用 service 既有 findAll 的租户可见过滤）
        const all = await this.service.findPaymentMethodsByIds(ctx, (await this.service.findAll(ctx)).items.flatMap(s => s.paymentMethods?.map(pm => pm.id) ?? []));
        return all.map((m: any) => ({ id: m.id, code: m.code, mode: 'installment', options: null, name: m.translations?.[0]?.name ?? m.code }));
    }
}