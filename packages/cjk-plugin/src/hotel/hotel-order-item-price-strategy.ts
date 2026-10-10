import {
    Injector,
    Order,
    OrderItemPriceCalculationStrategy,
    PriceCalculationResult,
    ProductVariant,
    RequestContext,
    roundMoney,
} from '@vendure/core';
import { calcNightlyPricing, parseHotelRoomConfig } from './hotel-nightly-pricing';
import { HotelRatePlanService } from './booking/rate-plan.service';
import { RatePlanAdjustment, isValidRatePlanAdjustment } from './booking/rate-plan-logic';

/**
 * 酒店房型订单行单价策略：
 * - 非酒店变体 / 缺日期 / 坏配置 → 直通默认定价（productVariant.listPrice），普通商品零影响；
 * - 酒店变体 → 按 hotelRoomConfig + 入离日期逐晚计价，单价 = 住宿总价 ÷ 数量，
 *   因 OrderLine.linePrice = unitPrice × quantity，故行小计 ≈ 住宿总价（晚数=数量）；
 * - P2 房价方案：OrderLine.customFields.ratePlanCode 存在时套用（enabled + 售卖期含入住日 + 会员达标，
 *   与 C 端可见性同口径）——discount/surcharge 叠加连住优惠，fixed 不叠加；坏 code / 不可用 → 回退基价。
 * 本 Vendure fork（3.6）的 calculateUnitPrice 支持 Promise（core 调用处均 await），故方案查询可异步。
 */
export class HotelOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    private ratePlanService: HotelRatePlanService | undefined;

    init(injector: Injector): void {
        this.ratePlanService = injector.get(HotelRatePlanService);
    }

    async calculateUnitPrice(
        ctx: RequestContext,
        productVariant: ProductVariant,
        orderLineCustomFields: { [key: string]: any },
        order: Order,
        quantity: number,
    ): Promise<PriceCalculationResult> {
        const fallback: PriceCalculationResult = {
            price: productVariant.listPrice,
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
        const cfg = parseHotelRoomConfig((productVariant as any).customFields?.hotelRoomConfig);
        if (!cfg) return fallback;

        const checkIn = orderLineCustomFields?.hotelCheckIn;
        const checkOut = orderLineCustomFields?.hotelCheckOut;
        if (typeof checkIn !== 'string' || typeof checkOut !== 'string') return fallback;

        const plan = await this.resolveRatePlan(ctx, productVariant, orderLineCustomFields, checkIn);
        const pricing = calcNightlyPricing(cfg, checkIn, checkOut, plan);
        if (!pricing) return fallback;

        const denom = Number.isFinite(quantity) && quantity > 0 ? quantity : pricing.nights.length;
        return {
            price: roundMoney(pricing.stayTotalCent / denom),
            // 酒店房价统一按含税挂牌价口径（与 C 端逐日价/hotelAvailability priceCent 一致），
            // 订单行 WithTax = 挂牌价，不再被默认税率放大
            priceIncludesTax: true,
        };
    }

    /** 行上 ratePlanCode → 可套用方案（不可用返回 null 回退基价）；非酒店方案/异常一律静默回退 */
    private async resolveRatePlan(
        ctx: RequestContext,
        productVariant: ProductVariant,
        orderLineCustomFields: { [key: string]: any },
        checkIn: string,
    ): Promise<RatePlanAdjustment | null> {
        const code = orderLineCustomFields?.ratePlanCode;
        if (typeof code !== 'string' || !code.trim() || !this.ratePlanService) return null;
        try {
            const memberLevel = await this.ratePlanService.resolveMemberLevel(ctx);
            const plan = await this.ratePlanService.findApplicableByCode(
                ctx,
                productVariant.id as any,
                code,
                checkIn,
                memberLevel,
            );
            if (!plan) return null;
            const adj: RatePlanAdjustment = { adjustType: plan.adjustType, adjustValue: plan.adjustValue };
            return isValidRatePlanAdjustment(adj) ? adj : null;
        } catch {
            // 方案查询异常不阻断下单计价：回退基价
            return null;
        }
    }
}
