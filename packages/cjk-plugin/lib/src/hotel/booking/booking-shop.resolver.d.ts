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
    /** 改期报价（改期弹层：规则拦截/逐晚房态/新旧价差；不落库） */
    hotelBookingRescheduleQuote(ctx: RequestContext, id: ID, checkIn: string, checkOut: string): Promise<{
        bookingId: ID;
        eligible: boolean;
        reason: string | null;
        message: string | null;
        oldCheckIn: string;
        oldCheckOut: string;
        newCheckIn: string;
        newCheckOut: string;
        nights: number;
        oldTotalCent: number;
        newTotalCent: number | null;
        diffCent: number | null;
        refundCent: number | null;
        supplementCent: number | null;
        availability: Array<{
            date: string;
            remaining: number | null;
            closed: boolean;
            feasible: boolean;
        }>;
    }>;
    /**
     * 顾客提交改期（归属隔离）：
     * applied=true 改期完成（等价/退差/补差即时到账）；applied=false 返回补差支付参数（paymentState/paymentPublic），
     * 支付成功后由服务端事件自动收口，前端轮询 myHotelBookings 即可。
     */
    rescheduleMyHotelBooking(ctx: RequestContext, id: ID, checkIn: string, checkOut: string, paymentMethod?: string): Promise<{
        booking: HotelBooking;
        applied: boolean;
        paymentState: string | null;
        paymentId: ID | null;
        supplementCent: number;
        paymentPublic: string | null;
    }>;
    /** 放弃在途改期补差（取消补差 Payment 并清空意向；归属隔离） */
    cancelMyRescheduleSupplement(ctx: RequestContext, id: ID): Promise<HotelBooking>;
}
