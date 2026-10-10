// 房量管理 Admin API（P1 Task 3）：web-admin 房量日历的读写入口
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
import { HotelRoomDay } from './room-day.entity';
import { HotelAvailabilityDay } from './hotel-inventory-shop.resolver';
import { nextDate } from './hotel-inventory-logic';

@Resolver()
export class HotelInventoryAdminResolver {
    constructor(private inventory: HotelInventoryService) {}

    @Query()
    @Allow(Permission.ReadCatalog, Permission.UpdateCatalog)
    async hotelRoomDays(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('month') month: string,
    ): Promise<HotelRoomDay[]> {
        return this.inventory.listRoomDays(ctx, variantId, month);
    }

    /** 与 shop 端同构（含两端窗口）；web-admin 房量日历「剩 N」用 */
    @Query()
    @Allow(Permission.ReadCatalog, Permission.UpdateCatalog)
    async hotelAvailability(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('from') from: string,
        @Args('to') to: string,
    ): Promise<HotelAvailabilityDay[]> {
        return this.inventory.getAvailabilityDetailed(ctx, variantId, from, nextDate(to));
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async setHotelRoomDay(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('date') date: string,
        @Args('totalRooms', { nullable: true }) totalRooms?: number,
        @Args('closed', { nullable: true }) closed?: boolean,
    ): Promise<HotelRoomDay> {
        return this.inventory.upsertRoomDay(ctx, variantId, date, { totalRooms, closed });
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async batchSetHotelRoomDays(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('from') from: string,
        @Args('to') to: string,
        @Args('totalRooms', { nullable: true }) totalRooms?: number,
        @Args('closed', { nullable: true }) closed?: boolean,
        @Args('weekdays', { type: () => [Number], nullable: true }) weekdays?: number[],
    ): Promise<number> {
        return this.inventory.batchUpsertRoomDays(ctx, variantId, from, to, { totalRooms, closed, weekdays });
    }
}
