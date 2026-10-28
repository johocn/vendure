import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, UserInputError } from '@vendure/core';

import { localizeText } from './localize';
import { Merchant } from './merchant.entity';
import { MerchantStore } from './merchant-store.entity';
import { MerchantStoreService } from './merchant-store.service';

/**
 * 商户/门店后台 API：读写商户主数据、门店、租户认领关系与门店员工。
 * 商户与门店是平台级主数据（非 ChannelAware），后台读写一律仅平台超管，
 * 避免租户枚举全平台商户/门店；C 端只走 shop-api 的公开投影。
 */
@Resolver()
export class MerchantAdminResolver {
    constructor(private merchantStoreService: MerchantStoreService) {}

    @Query()
    @Allow(Permission.SuperAdmin)
    async merchants(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.merchantStoreService.listMerchants(ctx, options ?? {});
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async merchant(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<Merchant | undefined> {
        return this.merchantStoreService.getMerchant(ctx, id);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async merchantStores(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.merchantStoreService.listStores(ctx, options ?? {});
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async merchantStore(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<MerchantStore | undefined> {
        return this.merchantStoreService.getStore(ctx, id);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async merchantStoreClaims(@Ctx() ctx: RequestContext, @Args('storeId') storeId: ID): Promise<any[]> {
        return this.merchantStoreService.listClaims(ctx, storeId);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async merchantStoreStaff(@Ctx() ctx: RequestContext, @Args('storeId') storeId: ID): Promise<any[]> {
        return this.merchantStoreService.listStoreStaff(ctx, storeId);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createMerchant(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<Merchant> {
        return this.merchantStoreService.createMerchant(ctx, input);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updateMerchant(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<Merchant> {
        return this.merchantStoreService.updateMerchant(ctx, input);
    }

    /** 删除商户（软删）：仍存在未删除门店时拒绝 */
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async deleteMerchant(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.merchantStoreService.deleteMerchant(ctx, id);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createMerchantStore(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<MerchantStore> {
        return this.merchantStoreService.createStore(ctx, input);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updateMerchantStore(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<MerchantStore> {
        return this.merchantStoreService.updateStore(ctx, input);
    }

    /** 删除门店（软删），并撤销其 ACTIVE 租户认领 */
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async deleteMerchantStore(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.merchantStoreService.deleteStore(ctx, id);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
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
    @Allow(Permission.SuperAdmin)
    async revokeMerchantStoreClaim(
        @Ctx() ctx: RequestContext,
        @Args('storeId') storeId: ID,
        @Args('channelId') channelId: ID,
    ): Promise<boolean> {
        return this.merchantStoreService.revokeClaim(ctx, storeId, channelId);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async upsertMerchantStoreStaff(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        if (input?.storeId == null || input?.userId == null) {
            throw new UserInputError('门店与后台用户不能为空');
        }
        return this.merchantStoreService.upsertStaff(ctx, input);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async removeMerchantStoreStaff(
        @Ctx() ctx: RequestContext,
        @Args('storeId') storeId: ID,
        @Args('userId') userId: ID,
    ): Promise<boolean> {
        return this.merchantStoreService.removeStaff(ctx, storeId, userId);
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

    // 以下为结算/证照敏感字段：仅超管可见，租户读请求返回 null
    @ResolveField()
    legalName(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.legalName);
    }

    @ResolveField()
    licenseNo(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.licenseNo);
    }

    @ResolveField()
    licenseImage(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.licenseImage);
    }

    @ResolveField()
    bankName(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.bankName);
    }

    @ResolveField()
    bankAccountName(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.bankAccountName);
    }

    @ResolveField()
    bankAccountNo(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.bankAccountNo);
    }

    @ResolveField()
    taxNo(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.taxNo);
    }

    @ResolveField()
    invoiceTitle(@Parent() merchant: Merchant, @Ctx() ctx: RequestContext): string | null {
        return MerchantFieldResolver.mask(ctx, merchant.invoiceTitle);
    }

    private static mask(ctx: RequestContext, value: string | null): string | null {
        if (!ctx.userHasPermissions([Permission.SuperAdmin])) {
            return null;
        }
        return value ?? null;
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
