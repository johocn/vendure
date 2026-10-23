import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { AddressChangeService } from './address-change.service';
import { CampusPermissions } from './permissions';

/** 顾客端：订单详情「修改地址」（取货前可改，可跨分区，差额记台账） */
@Resolver()
export class AddressChangeShopResolver {
    constructor(private service: AddressChangeService) {}

    @Mutation()
    @Allow(Permission.Authenticated)
    campusChangeDeliveryAddress(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('zoneId') zoneId: ID,
        @Args('buildingId') buildingId: ID,
        @Args({ name: 'detail', type: () => String, nullable: true }) detail?: string,
    ) {
        return this.service.changeByCustomer(ctx, { orderId, zoneId, buildingId, detail });
    }

    /** 顾客端：本单最近一次改址差额状态（待补/待退/已结清） */
    @Query()
    @Allow(Permission.Authenticated)
    campusMyAddressChange(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.service.myLatest(ctx, orderId);
    }
}

/** 运营端：改址台账查询/统计/结清 */
@Resolver()
export class AddressChangeAdminResolver {
    constructor(private service: AddressChangeService) {}

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    campusAddressChanges(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.service.list(ctx, { status, skip, take });
    }

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    campusAddressChangeStats(@Ctx() ctx: RequestContext) {
        return this.service.stats(ctx);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    campusSettleAddressChange(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('action') action: string,
    ) {
        return this.service.settle(ctx, id, action);
    }

    /** 运营代客改址（取货后也可代改，必须填原因） */
    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    campusAdminChangeDeliveryAddress(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('zoneId') zoneId: ID,
        @Args('buildingId') buildingId: ID,
        @Args({ name: 'detail', type: () => String, nullable: true }) detail: string | undefined,
        @Args('reason') reason: string,
    ) {
        return this.service.adminChange(ctx, { orderId, zoneId, buildingId, detail, reason });
    }

    /** 改址差额试算（不写台账） */
    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    campusAdminQuoteAddressChange(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('zoneId') zoneId: ID,
    ) {
        return this.service.quote(ctx, orderId, zoneId);
    }

    /** 动态计价试算预览（当前供需 + 各分区加价拆解） */
    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    campusDynamicPricingPreview(@Ctx() ctx: RequestContext) {
        return this.service.dynamicPreview(ctx);
    }
}
