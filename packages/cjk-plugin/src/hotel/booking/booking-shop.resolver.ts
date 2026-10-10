// 酒店预订单 Shop API（P3 Task 11）：C 端「我的预订」（订单详情预订卡，Task 12）数据源
// 归属隔离：按当前登录顾客名下订单过滤，未登录/无顾客返回空列表（绝不返回他人预订）
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    CustomerService,
    ID,
    Permission,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { Order } from '@vendure/core';

import { HotelBookingService } from './booking.service';
import { HotelBooking } from './booking.entity';

@Resolver()
export class HotelBookingShopResolver {
    constructor(
        private bookingService: HotelBookingService,
        private customerService: CustomerService,
        private conn: TransactionalConnection,
    ) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myHotelBookings(
        @Ctx() ctx: RequestContext,
        @Args('status', { nullable: true }) status?: string,
    ): Promise<HotelBooking[]> {
        if (!ctx.activeUserId) return [];
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) return [];
        const orderRows = await this.conn
            .getRepository(ctx, Order)
            .find({ where: { customer: { id: customer.id } as any }, select: ['id'] });
        return this.bookingService.listForCustomer(
            ctx,
            orderRows.map(o => Number(o.id)),
            status,
        );
    }
}
