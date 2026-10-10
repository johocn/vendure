// 酒店预订单 Admin API（P3 Task 11）：商家端预订管理页（Task 13）读写入口
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Permission,
    RequestContext,
    Transaction,
    UserInputError,
} from '@vendure/core';

import { HotelBookingService, HotelBookingAdminFilter } from './booking.service';
import { HotelBooking } from './booking.entity';

@Resolver()
export class HotelBookingAdminResolver {
    constructor(private bookingService: HotelBookingService) {}

    @Query()
    @Allow(Permission.ReadCatalog, Permission.UpdateCatalog)
    async hotelBookings(
        @Ctx() ctx: RequestContext,
        @Args('filter', { nullable: true }) filter?: HotelBookingAdminFilter,
    ): Promise<HotelBooking[]> {
        return this.bookingService.listForAdmin(ctx, filter ?? {});
    }

    /** 到店核销：凭 8 位入住码（扫码/输码同一入口）；仅 confirmed 且当日 ∈ [checkIn, checkOut) */
    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async hotelBookingCheckIn(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
    ): Promise<HotelBooking> {
        try {
            return await this.bookingService.checkIn(ctx, { code });
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'CHECK_IN_FAILED');
        }
    }

    /** 手动完成离店（日常定时任务会兜底自动完成） */
    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async hotelBookingComplete(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<HotelBooking> {
        try {
            return await this.bookingService.complete(ctx, id);
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'COMPLETE_FAILED');
        }
    }

    /** 强制取消（pendingDeposit/confirmed → cancelled 并释放锁房；退款走 Task 14 售后单） */
    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async hotelBookingForceCancel(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason', { nullable: true }) reason?: string,
    ): Promise<HotelBooking> {
        try {
            return await this.bookingService.forceCancel(ctx, id, reason);
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'FORCE_CANCEL_FAILED');
        }
    }
}
