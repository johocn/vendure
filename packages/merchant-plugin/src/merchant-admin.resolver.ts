import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, UserInputError } from '@vendure/core';

import { localizeText } from './localize';
import { Merchant } from './merchant.entity';
import { MerchantStore } from './merchant-store.entity';
import { MerchantStoreService } from './merchant-store.service';

/**
 * 商户/门店后台 API：读写商户主数据、门店、租户认领关系与门店员工。
 * 权限沿用订单更新权限（Permission.UpdateOrder），与既有运营插件保持一致。
 */
@Resolver()
export class MerchantAdminResolver {
    constructor(private merchantStoreService: MerchantStoreService) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async merchants(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.merchantStoreService.listMerchants(ctx, options ?? {});
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async merchant(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Merchant | undefined> {
        return this.merchantStoreService.getMerchant(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async merchantStores(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.merchantStoreService.listStores(ctx, options ?? {});
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async merchantStore(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<MerchantStore | undefined> {
        return this.merchantStoreService.getStore(ctx, id);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async merchantStoreClaims(@Ctx() ctx: RequestContext, @Args('storeId') storeId: ID): Promise<any[]> {
        return this.merchantStoreService.listClaims(ctx, storeId);
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async merchantStoreStaff(@Ctx() ctx: RequestContext, @Args('storeId') storeId: ID): Promise<any[]> {
        return this.merchantStoreService.listStoreStaff(ctx, storeId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async createMerchant(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<Merchant> {
        return this.merchantStoreService.createMerchant(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async updateMerchant(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<Merchant> {
        return this.merchantStoreService.updateMerchant(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async createMerchantStore(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<MerchantStore> {
        return this.merchantStoreService.createStore(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async updateMerchantStore(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<MerchantStore> {
        return this.merchantStoreService.updateStore(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async claimMerchantStore(
        @Ctx() ctx: RequestContext,
        @Args('storeId') storeId: ID,
        @Args('channelId') channelId: ID,
        @Args('role', { nullable: true }) role?: string,
        @Args('contractNo', { nullable: true }) contractNo?: string,
    ): Promise<any> {
        return this.merchantStoreService.claimStore(ctx, { storeId, channelId, role, contractNo });
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async revokeMerchantStoreClaim(
        @Ctx() ctx: RequestContext,
        @Args('storeId') storeId: ID,
        @Args('channelId') channelId: ID,
    ): Promise<boolean> {
        return this.merchantStoreService.revokeClaim(ctx, storeId, channelId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async upsertMerchantStoreStaff(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        if (input?.storeId == null || input?.userId == null) {
            throw new UserInputError('门店与后台用户不能为空');
        }
        return this.merchantStoreService.upsertStaff(ctx, input);
    }
}

/** Merchant.name / intro 的本地化输出解析 */
@Resolver('Merchant')
export class MerchantFieldResolver {
    @ResolveField()
    name(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string {
        return localizeText(merchant.name as any, ctx.languageCode, '');
    }

    @ResolveField()
    intro(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        if (merchant.intro == null) {
            return null;
        }
        return localizeText(merchant.intro as any, ctx.languageCode, '') || null;
    }
}

/** MerchantStore.name / notice 的本地化输出解析，simple-json 字段统一序列化为 JSON 字符串 */
@Resolver('MerchantStore')
export class MerchantStoreFieldResolver {
    @ResolveField()
    name(@Parent() store: MerchantStore, @Ctx() ctx: RequestContext): string {
        return localizeText(store.name as any, ctx.languageCode, '');
    }

    @ResolveField()
    notice(@Parent() store: MerchantStore, @Ctx() ctx: RequestContext): string | null {
        if (store.notice == null) {
            return null;
        }
        return localizeText(store.notice as any, ctx.languageCode, '') || null;
    }

    @ResolveField()
    businessHours(@Parent() store: MerchantStore): string | null {
        return MerchantStoreFieldResolver.jsonText(store.businessHours);
    }

    @ResolveField()
    specialDates(@Parent() store: MerchantStore): string | null {
        return MerchantStoreFieldResolver.jsonText(store.specialDates);
    }

    @ResolveField()
    holidayPlan(@Parent() store: MerchantStore): string | null {
        return MerchantStoreFieldResolver.jsonText(store.holidayPlan);
    }

    @ResolveField()
    externalIds(@Parent() store: MerchantStore): string | null {
        return MerchantStoreFieldResolver.jsonText(store.externalIds);
    }

    private static jsonText(value: unknown): string | null {
        if (value == null) {
            return null;
        }
        return typeof value === 'string' ? value : JSON.stringify(value);
    }
}
