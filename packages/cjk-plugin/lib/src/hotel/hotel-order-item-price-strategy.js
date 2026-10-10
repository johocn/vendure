"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelOrderItemPriceCalculationStrategy = void 0;
const core_1 = require("@vendure/core");
const hotel_nightly_pricing_1 = require("./hotel-nightly-pricing");
const rate_plan_service_1 = require("./booking/rate-plan.service");
const rate_plan_logic_1 = require("./booking/rate-plan-logic");
/**
 * 酒店房型订单行单价策略：
 * - 非酒店变体 / 缺日期 / 坏配置 → 直通默认定价（productVariant.listPrice），普通商品零影响；
 * - 酒店变体 → 按 hotelRoomConfig + 入离日期逐晚计价，单价 = 住宿总价 ÷ 数量，
 *   因 OrderLine.linePrice = unitPrice × quantity，故行小计 ≈ 住宿总价（晚数=数量）；
 * - P2 房价方案：OrderLine.customFields.ratePlanCode 存在时套用（enabled + 售卖期含入住日 + 会员达标，
 *   与 C 端可见性同口径）——discount/surcharge 叠加连住优惠，fixed 不叠加；坏 code / 不可用 → 回退基价。
 * 本 Vendure fork（3.6）的 calculateUnitPrice 支持 Promise（core 调用处均 await），故方案查询可异步。
 */
class HotelOrderItemPriceCalculationStrategy {
    init(injector) {
        this.ratePlanService = injector.get(rate_plan_service_1.HotelRatePlanService);
    }
    async calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity) {
        var _a;
        const fallback = {
            price: productVariant.listPrice,
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_a = productVariant.customFields) === null || _a === void 0 ? void 0 : _a.hotelRoomConfig);
        if (!cfg)
            return fallback;
        const checkIn = orderLineCustomFields === null || orderLineCustomFields === void 0 ? void 0 : orderLineCustomFields.hotelCheckIn;
        const checkOut = orderLineCustomFields === null || orderLineCustomFields === void 0 ? void 0 : orderLineCustomFields.hotelCheckOut;
        if (typeof checkIn !== 'string' || typeof checkOut !== 'string')
            return fallback;
        const plan = await this.resolveRatePlan(ctx, productVariant, orderLineCustomFields, checkIn);
        const pricing = (0, hotel_nightly_pricing_1.calcNightlyPricing)(cfg, checkIn, checkOut, plan);
        if (!pricing)
            return fallback;
        const denom = Number.isFinite(quantity) && quantity > 0 ? quantity : pricing.nights.length;
        return {
            price: (0, core_1.roundMoney)(pricing.stayTotalCent / denom),
            priceIncludesTax: productVariant.listPriceIncludesTax,
        };
    }
    /** 行上 ratePlanCode → 可套用方案（不可用返回 null 回退基价）；非酒店方案/异常一律静默回退 */
    async resolveRatePlan(ctx, productVariant, orderLineCustomFields, checkIn) {
        const code = orderLineCustomFields === null || orderLineCustomFields === void 0 ? void 0 : orderLineCustomFields.ratePlanCode;
        if (typeof code !== 'string' || !code.trim() || !this.ratePlanService)
            return null;
        try {
            const memberLevel = await this.ratePlanService.resolveMemberLevel(ctx);
            const plan = await this.ratePlanService.findApplicableByCode(ctx, productVariant.id, code, checkIn, memberLevel);
            if (!plan)
                return null;
            const adj = { adjustType: plan.adjustType, adjustValue: plan.adjustValue };
            return (0, rate_plan_logic_1.isValidRatePlanAdjustment)(adj) ? adj : null;
        }
        catch (_a) {
            // 方案查询异常不阻断下单计价：回退基价
            return null;
        }
    }
}
exports.HotelOrderItemPriceCalculationStrategy = HotelOrderItemPriceCalculationStrategy;
//# sourceMappingURL=hotel-order-item-price-strategy.js.map