// 房态查询 Shop API（P1 Task 3）：C 端日历/DateBar 余量展示
// 窗口语义：[from, to] 含两端；每晚报价复用 calcNightlyPricing（单晚粒度，不叠加连住折扣）
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, ProductVariant, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
import { parseHotelRoomConfig, calcNightlyPricing } from '../hotel-nightly-pricing';
import { dayTypeFor, PriceSegmentType } from '../hotel-config';
import { nextDate } from './hotel-inventory-logic';

export class HotelAvailabilityDay {
    date!: string;
    priceCent!: number;
    dayType!: PriceSegmentType;
    /** null = 不限房 */
    remaining!: number | null;
    closed!: boolean;
}

@Resolver()
export class HotelInventoryShopResolver {
    constructor(private inventory: HotelInventoryService, private conn: TransactionalConnection) {}

    @Query()
    @Allow(Permission.Public)
    async hotelAvailability(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('from') from: string,
        @Args('to') to: string,
    ): Promise<HotelAvailabilityDay[]> {
        // getAvailability 为「含头不含尾」晚序列，窗口含尾日 → to+1
        const rows = await this.inventory.getAvailability(ctx, variantId, from, nextDate(to));
        const variant = await this.conn.getRepository(ctx, ProductVariant).findOne({
            where: { id: variantId as any },
            loadEagerRelations: false,
        });
        const cfg = parseHotelRoomConfig((variant?.customFields as any)?.hotelRoomConfig);
        const segments = Array.isArray(cfg?.priceCalendar) ? cfg!.priceCalendar! : [];
        return rows.map(r => {
            const pricing = calcNightlyPricing(cfg, r.date, nextDate(r.date));
            return {
                date: r.date,
                priceCent: pricing?.nights[0]?.priceCent ?? cfg?.basePriceCent ?? 0,
                dayType: dayTypeFor(r.date, segments),
                remaining: r.remaining,
                closed: r.closed,
            };
        });
    }
}
