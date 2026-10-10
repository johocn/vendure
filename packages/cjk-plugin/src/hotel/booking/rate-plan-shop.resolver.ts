// 房价方案 Shop API（P2 Task 7）：C 端方案 chips 数据源
// 可见性口径与计价策略一致（isRatePlanSaleable）：enabled + 会员等级门槛 + 售卖期（checkIn 可选过滤）
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { HotelRatePlanService } from './rate-plan.service';

export class HotelRatePlanPublic {
    id!: string;
    code!: string;
    /** 纯文本或 LocalizedText JSON 字符串（string | Record<locale,string>），C 端 localizeText 解析 */
    name!: string;
    /** discount | fixed | surcharge */
    adjustType!: string;
    /** discount 千分比（900=×0.9）；fixed/surcharge 分 */
    adjustValue!: number;
    /** 会员等级门槛（数字字符串，达到该等级及以上可见）；null = 全员 */
    memberOnly!: string | null;
    /** 日均价预估（变体基准价套用单晚方案价，分）；精确逐晚价由 C 端按入住区间重算 */
    avgNightlyEstimateCent!: number;
}

@Resolver()
export class HotelRatePlanShopResolver {
    constructor(private ratePlanService: HotelRatePlanService) {}

    @Query()
    @Allow(Permission.Public)
    async hotelRatePlans(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('checkIn', { nullable: true }) checkIn?: string,
    ): Promise<HotelRatePlanPublic[]> {
        return this.ratePlanService.listVisibleWithEstimate(ctx, variantId, { checkIn: checkIn ?? null });
    }
}
