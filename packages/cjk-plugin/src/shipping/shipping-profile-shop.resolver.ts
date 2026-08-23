import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { ShippingProfileService } from './shipping-profile.service';
import { PickupLocation } from '../pickup/pickup-location.entity';

@Resolver()
export class ShippingProfileShopResolver {
    constructor(private service: ShippingProfileService) {}

    @Query()
    async eligibleShippingMethodsByProfile(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const intersected = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        if (intersected.length === 0) return [];
        return (await this.service.findShippingMethodsByIds(ctx, intersected.map(m => m.id)))
            .filter((m: any) => m.customFields?.enabled !== false);
    }

    @Query()
    async checkShippingProfileCompatibility(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const methods = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        return {
            compatible: methods.length > 0,
            intersectedCount: methods.length,
        };
    }

    @Query()
    async eligibleShippingMethodsWithConfig(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ) {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const intersected = await this.service.getIntersectedShippingMethods(ctx, profileIds);
        if (intersected.length === 0) return [];
        const configs = new Map<ID, any>();
        for (const pid of profileIds) {
            const rows = await this.service.getMethodConfigsByProfile(ctx, pid);
            for (const r of rows) configs.set(r.shippingMethodId as any, r);
        }
        const full = await this.service.findShippingMethodsByIds(ctx, intersected.map(m => m.id));
        return full
            .filter((m: any) => m.customFields?.enabled !== false)
            .map((m: any) => {
                const cfg = configs.get(m.id);
                const pickupIds = cfg && cfg.mode === 'pickup' ? cfg.options?.pickupLocationIds ?? [] : null;
                return { id: m.id, code: m.code, mode: cfg?.mode ?? null, pickupLocationIds: pickupIds, name: m.translations?.[0]?.name ?? m.code };
            });
    }

    @Query()
    async resolveShippingMethodsForChannel(@Ctx() ctx: RequestContext) {
        const def = await this.service.getTenantDefault(ctx);
        if (def) {
            const ids = (def.shippingMethods ?? []).map(m => m.id);
            const full = await this.service.findShippingMethodsByIds(ctx, ids);
            const configs = await this.service.getMethodConfigsByProfile(ctx, def.id as any);
            const cm = new Map(configs.map(c => [String(c.shippingMethodId), c]));
            return full
                .filter((m: any) => m.customFields?.enabled !== false)
                .map((m: any) => ({
                id: m.id, code: m.code,
                mode: cm.get(String(m.id))?.mode ?? null,
                pickupLocationIds: cm.get(String(m.id))?.options?.pickupLocationIds ?? null,
                name: m.translations?.[0]?.name ?? m.code,
            }));
        }
        // 无默认档案 → 返回当前可见的全部配送方式（沿用 service 既有 findAll 的租户可见过滤）
        const all = await this.service.findShippingMethodsByIds(ctx, (await this.service.findAll(ctx)).items.flatMap(s => s.shippingMethods?.map(sm => sm.id) ?? []));
        return all
            .filter((m: any) => m.customFields?.enabled !== false)
            .map((m: any) => ({ id: m.id, code: m.code, mode: null, pickupLocationIds: null, name: m.translations?.[0]?.name ?? m.code }));
    }

    /**
     * 按 Profile 交集查询允许的自提点。
     * 返回值语义：
     * - []  → 所有 Profile 都未约束自提点（前端展示全部），或交集为空（前端展示"无可用"）
     * - [locations] → 交集非空，前端仅展示这些自提点
     * 前端需配合 checkPickupLocationConstraint 查询区分两种 [] 情况
     */
    @Query()
    async eligiblePickupLocationsByProfile(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ): Promise<PickupLocation[]> {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        const ids = await this.service.getIntersectedPickupLocationsWithConfig(ctx, profileIds);
        if (ids === null || ids.length === 0) return [];
        return await this.service.findPickupLocationsByIds(ctx, ids);
    }

    @Query()
    async checkPickupLocationConstraint(
        @Ctx() ctx: RequestContext,
        @Args('profileIds') profileIds: ID[],
    ): Promise<boolean> {
        profileIds = await this.service.resolveEffectiveProfileIds(ctx, profileIds);
        return this.service.hasPickupLocationConstraint(ctx, profileIds);
    }
}