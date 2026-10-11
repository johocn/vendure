import { CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { HotelBookingService } from './booking.service';
import { HotelBooking } from './booking.entity';
export declare class HotelBookingShopResolver {
    private bookingService;
    private customerService;
    private conn;
    constructor(bookingService: HotelBookingService, customerService: CustomerService, conn: TransactionalConnection);
    /** 当前顾客名下订单 id 集合（归属隔离唯一口径；未登录返回 null） */
    private ownOrderIds;
    /** 取预订并校验归属，违规一律 UserInputError（不泄漏存在性） */
    private loadOwnedBooking;
    myHotelBookings(ctx: RequestContext, status?: string): Promise<HotelBooking[]>;
    /** 取消报价（取消按钮二次确认弹层数据源） */
    hotelBookingCancelQuote(ctx: RequestContext, id: ID): Promise<{
        bookingId: ID;
        mode: string;
        free: boolean;
        cancellable: boolean;
        refundCent: number;
        feeCent: number;
        totalCent: number;
        paidCent: number;
        firstNightFeeCent: number;
        deadline: Date | null;
    }>;
    /** 顾客自助取消（退款链路在 service；partial 返回时预订仍为 confirmed，等售后审批收口） */
    cancelMyHotelBooking(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking>;
}
