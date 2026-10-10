import { ID, RequestContext } from '@vendure/core';
import { HotelBookingService, HotelBookingAdminFilter } from './booking.service';
import { HotelBooking } from './booking.entity';
export declare class HotelBookingAdminResolver {
    private bookingService;
    constructor(bookingService: HotelBookingService);
    hotelBookings(ctx: RequestContext, filter?: HotelBookingAdminFilter): Promise<HotelBooking[]>;
    /** 到店核销：凭 8 位入住码（扫码/输码同一入口）；仅 confirmed 且当日 ∈ [checkIn, checkOut) */
    hotelBookingCheckIn(ctx: RequestContext, code: string): Promise<HotelBooking>;
    /** 手动完成离店（日常定时任务会兜底自动完成） */
    hotelBookingComplete(ctx: RequestContext, id: ID): Promise<HotelBooking>;
    /** 强制取消（pendingDeposit/confirmed → cancelled 并释放锁房；退款走 Task 14 售后单） */
    hotelBookingForceCancel(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking>;
}
