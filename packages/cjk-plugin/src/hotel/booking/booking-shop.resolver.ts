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

import { HotelBookingService, HotelCancelQuoteResult } from './booking.service';
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
}
