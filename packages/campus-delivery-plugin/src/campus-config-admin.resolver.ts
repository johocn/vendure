import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, UserInputError } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { ErrandService } from './errand.service';
import { MerchantAdminService } from './merchant-admin.service';
import { CampusPermissions } from './permissions';
import { ShippingProfileEnsureService } from './shipping-profile-ensure.service';
import { WaimaiStoreService } from './waimai-store.service';

@Resolver()
export class CampusConfigAdminResolver {
    constructor(
        private config: CampusConfigService,
        private errand: ErrandService,
        private stores: WaimaiStoreService,
        private profileEnsure: ShippingProfileEnsureService,
        private merchant: MerchantAdminService,
    ) {}

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusZones(@Ctx() ctx: RequestContext) {
        return this.config.listZones(ctx);
    }

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusBuildings(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'zoneId', nullable: true }) zoneId?: ID,
    ) {
        return this.config.listBuildings(ctx, zoneId != null ? Number(zoneId) : undefined);
    }

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusConfig(@Ctx() ctx: RequestContext) {
        return this.config.getConfig(ctx);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusCreateZone(
        @Ctx() ctx: RequestContext,
        @Args('name') name: string,
        @Args('fee') fee: number,
    ) {
        return this.config.createZone(ctx, name, fee);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusUpdateZone(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'name', type: () => String, nullable: true }) name?: string,
        @Args({ name: 'fee', type: () => Number, nullable: true }) fee?: number,
    ) {
        return this.config.updateZone(ctx, Number(id), { name, fee });
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusDeleteBuilding(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.config.deleteBuilding(ctx, Number(id));
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusCreateBuilding(
        @Ctx() ctx: RequestContext,
        @Args('name') name: string,
        @Args('zoneId') zoneId: ID,
        @Args('detail', { nullable: true }) detail?: string,
        @Args('lat', { nullable: true, type: () => Number }) lat?: number,
        @Args('lng', { nullable: true, type: () => Number }) lng?: number,
    ) {
        return this.config.createBuilding(ctx, name, Number(zoneId), detail, lat, lng);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusUpdateBuilding(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: { name?: string; detail?: string; lat?: number | null; lng?: number | null },
    ) {
        return this.config.updateBuilding(ctx, Number(id), input);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusUpdateConfig(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.config.updateConfig(ctx, input);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusCreateSlot(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.config.createSlot(ctx, input);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusUpdateSlot(@Ctx() ctx: RequestContext, @Args('id') id: number, @Args('input') input: any) {
        return this.config.updateSlot(ctx, id, input);
    }

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusSlots(@Ctx() ctx: RequestContext) {
        return this.config.listSlots(ctx);
    }

    /** R5 跑腿单：幂等创建 0 元载体商品（SKU 查重），C 端 addItemToOrder 用其 variantId */
    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusEnsureErrandProducts(@Ctx() ctx: RequestContext) {
        const { variantId, sku } = await this.errand.ensureErrandProduct(ctx);
        return { variantId, sku };
    }

    /** 拾光达店铺配置：平台超管看全店铺；租户管理员仅看本渠道 */
    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusStoreConfigs(@Ctx() ctx: RequestContext) {
        const all = await this.stores.listStoreConfigs(ctx);
        if (this.isPlatformAdmin(ctx)) return all;
        return all.filter(s => Number(s.channelId) === Number(ctx.channelId));
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusUpdateStoreConfig(
        @Ctx() ctx: RequestContext,
        @Args('channelId') channelId: ID,
        @Args('input') input: any,
    ) {
        this.assertChannelScope(ctx, Number(channelId));
        return this.stores.updateStoreConfig(ctx, Number(channelId), input);
    }

    /** 运营中心推送/重推外部快递（R2 待推送、R3 外部策略；复用商家侧同源实现，带渠道归属校验） */
    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusAdminDispatchExternal(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('provider') provider: string,
    ) {
        return this.merchant.dispatchExternal(ctx, orderId, provider as any);
    }

    /** 运营中心取消外部快递（换一家重推前，或运力失败回落大厅） */
    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusAdminCancelExternal(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args({ name: 'reason', type: () => String, nullable: true }) reason?: string,
    ) {
        return this.merchant.cancelExternal(ctx, orderId, reason);
    }

    /** R2/R4 档案冲突治本：get-or-create 渠道合并默认配送档案（store-pickup+courier-delivery）并补绑未绑档案变体 */
    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusEnsureDefaultShippingProfile(@Ctx() ctx: RequestContext, @Args('channelId') channelId: ID) {
        this.assertChannelScope(ctx, Number(channelId));
        return this.profileEnsure.ensureDefaultShippingProfile(ctx, Number(channelId));
    }

    /** 平台超管（跨租户视角）判定：与 cjk wallet-admin 同口径 */
    private isPlatformAdmin(ctx: RequestContext): boolean {
        return ctx.userHasPermissions([Permission.SuperAdmin]);
    }

    /** 租户隔离：平台超管可操作任意渠道，租户管理员只能操作当前渠道（防跨店铺改他人履约配置） */
    private assertChannelScope(ctx: RequestContext, channelId: number) {
        if (this.isPlatformAdmin(ctx)) return;
        if (Number(channelId) === Number(ctx.channelId)) return;
        throw new UserInputError('无权操作其他店铺的履约配置');
    }
}
