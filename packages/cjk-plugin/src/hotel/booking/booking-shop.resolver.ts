// 酒店预订单 Shop API（P3 Task 11 / P4 Task 14）：
// - C 端「我的预订」（订单详情预订卡，Task 12）数据源
// - Task 14：取消报价 + 顾客自助取消
// 归属隔离：按当前登录顾客名下订单过滤，未登录/无顾客返回空（绝不返回他人预订）
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    CustomerService,
    ID,
    Permission,
    RequestContext,
    Transaction,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Order } from '@vendure/core';

import { HotelBookingService, HotelCancelQuoteResult, HotelRescheduleQuoteResult } from './booking.service';
import { HotelBooking } from './booking.entity';

@Resolver()
export class HotelBookingShopResolver {
    constructor(
        private bookingService: HotelBookingService,
        private customerService: CustomerService,
        private conn: TransactionalConnection,
    ) {}

    /** 当前顾客名下订单 id 集合（归属隔离唯一口径；未登录返回 null） */
    private async ownOrderIds(ctx: RequestContext): Promise<number[] | null> {
        if (!ctx.activeUserId) return null;
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) return null;
        const orderRows = await this.conn
            .getRepository(ctx, Order)
            .find({ where: { customer: { id: customer.id } as any }, select: ['id'] });
        return orderRows.map(o => Number(o.id));
    }

    /** 取预订并校验归属，违规一律 UserInputError（不泄漏存在性） */
    private async loadOwnedBooking(ctx: RequestContext, id: ID): Promise<HotelBooking> {
        const ownIds = await this.ownOrderIds(ctx);
        if (!ownIds) throw new UserInputError('请先登录');
        const detail = await this.conn.getRepository(ctx, HotelBooking).findOne({
            where: { id: Number(id) },
        });
        if (!detail || !ownIds.includes(Number(detail.orderId))) {
            throw new UserInputError('预订单不存在');
        }
        return detail;
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myHotelBookings(
        @Ctx() ctx: RequestContext,
        @Args('status', { nullable: true }) status?: string,
    ): Promise<HotelBooking[]> {
        const orderIds = await this.ownOrderIds(ctx);
        if (!orderIds) return [];
        return this.bookingService.listForCustomer(ctx, orderIds, status);
    }

    /** 取消报价（取消按钮二次确认弹层数据源） */
    @Query()
    @Allow(Permission.Authenticated)
    async hotelBookingCancelQuote(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<{
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
    }> {
        await this.loadOwnedBooking(ctx, id);
        try {
            const result: HotelCancelQuoteResult = await this.bookingService.quoteCancel(ctx, id);
            return {
                bookingId: result.booking.id,
                mode: result.quote.mode,
                free: result.quote.free,
                cancellable: result.quote.cancellable,
                refundCent: result.quote.refundCent,
                feeCent: result.quote.feeCent,
                totalCent: result.booking.totalCent,
                paidCent: result.paidCent,
                firstNightFeeCent: result.firstNightFeeCent,
                deadline: result.quote.deadline,
            };
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'CANCEL_QUOTE_FAILED');
        }
    }

    /** 顾客自助取消（退款链路在 service；partial 返回时预订仍为 confirmed，等售后审批收口） */
    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async cancelMyHotelBooking(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason', { nullable: true }) reason?: string,
    ): Promise<HotelBooking> {
        await this.loadOwnedBooking(ctx, id);
        try {
            return await this.bookingService.cancelByCustomer(ctx, id, reason);
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'CANCEL_FAILED');
        }
    }

    /** 改期报价（改期弹层：规则拦截/逐晚房态/新旧价差；不落库） */
    @Query()
    @Allow(Permission.Authenticated)
    async hotelBookingRescheduleQuote(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('checkIn') checkIn: string,
        @Args('checkOut') checkOut: string,
    ): Promise<{
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
        availability: Array<{ date: string; remaining: number | null; closed: boolean; feasible: boolean }>;
    }> {
        await this.loadOwnedBooking(ctx, id);
        try {
            const r: HotelRescheduleQuoteResult = await this.bookingService.quoteReschedule(ctx, id, {
                checkIn,
                checkOut,
            });
            return {
                bookingId: r.booking.id,
                eligible: r.eligible,
                reason: r.reason ?? null,
                message: r.message ?? null,
                oldCheckIn: r.oldCheckIn,
                oldCheckOut: r.oldCheckOut,
                newCheckIn: r.newCheckIn,
                newCheckOut: r.newCheckOut,
                nights: r.nights,
                oldTotalCent: r.oldTotalCent,
                newTotalCent: r.newTotalCent,
                diffCent: r.diffCent,
                refundCent: r.refundCent,
                supplementCent: r.supplementCent,
                availability: r.availability,
            };
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'RESCHEDULE_QUOTE_FAILED');
        }
    }

    /**
     * 顾客提交改期（归属隔离）：
     * applied=true 改期完成（等价/退差/补差即时到账）；applied=false 返回补差支付参数（paymentState/paymentPublic），
     * 支付成功后由服务端事件自动收口，前端轮询 myHotelBookings 即可。
     */
    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async rescheduleMyHotelBooking(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('checkIn') checkIn: string,
        @Args('checkOut') checkOut: string,
        @Args('paymentMethod', { nullable: true }) paymentMethod?: string,
    ): Promise<{
        booking: HotelBooking;
        applied: boolean;
        paymentState: string | null;
        paymentId: ID | null;
        supplementCent: number;
        paymentPublic: string | null;
    }> {
        await this.loadOwnedBooking(ctx, id);
        try {
            const r = await this.bookingService.rescheduleByCustomer(ctx, id, {
                checkIn,
                checkOut,
                paymentMethod,
            });
            return {
                booking: r.booking,
                applied: r.applied,
                paymentState: r.paymentState,
                paymentId: r.paymentId as any,
                supplementCent: r.supplementCent,
                paymentPublic: r.paymentPublic ? JSON.stringify(r.paymentPublic) : null,
            };
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'RESCHEDULE_FAILED');
        }
    }

    /** 放弃在途改期补差（取消补差 Payment 并清空意向；归属隔离） */
    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async cancelMyRescheduleSupplement(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<HotelBooking> {
        await this.loadOwnedBooking(ctx, id);
        try {
            return await this.bookingService.cancelRescheduleSupplement(ctx, id);
        } catch (e: any) {
            throw new UserInputError(e?.message ?? 'RESCHEDULE_SUPPLEMENT_CANCEL_FAILED');
        }
    }
}
