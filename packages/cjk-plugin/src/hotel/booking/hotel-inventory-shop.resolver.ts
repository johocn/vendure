// 房态查询 Shop API（P1 Task 3）：C 端日历/DateBar 余量展示
// 窗口语义：[from, to] 含两端；每晚报价复用 calcNightlyPricing（单晚粒度，不叠加连住折扣）
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
import { nextDate } from './hotel-inventory-logic';

export class HotelAvailabilityDay {
    date!: string;
    priceCent!: number;
    dayType!: string;
    /** null = 不限房 */
    remaining!: number | null;
    closed!: boolean;
}

@Resolver()
export class HotelInventoryShopResolver {
    constructor(private inventory: HotelInventoryService) {}

    @Query()
    @Allow(Permission.Public)
    async hotelAvailability(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('from') from: string,
        @Args('to') to: string,
    ): Promise<HotelAvailabilityDay[]> {
        // getAvailability 为「含头不含尾」晚序列，窗口含尾日 → to+1
        return this.inventory.getAvailabilityDetailed(ctx, variantId, from, nextDate(to));
    }
}
