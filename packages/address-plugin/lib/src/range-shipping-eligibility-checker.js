"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rangeShippingEligibilityChecker = void 0;
const core_1 = require("@vendure/core");
const delivery_range_entity_1 = require("./delivery-range.entity");
const shipping_rules_1 = require("./shipping-rules");
/** init 注入的连接（供逐店读取配送范围）。 */
let connection;
/**
 * 结算拦截：逐店校验配送范围（circle/district/all），任一店不可达即视为该 ShippingMethod 不适用
 * （结算不展示该方式，报价阶段即拦截）。每次求值都从 DB 读取最新配送范围，故不定义 shouldRunCheck
 * （Vendure 会缓存 shouldRunCheck 返回值，而 range 由 admin 外部修改，缓存会导致旧判定复用）。
 * 未设置收件区码/经纬度 → 直接放行（让常规流程执行）。
 */
exports.rangeShippingEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'range-delivery-eligibility',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '配送范围拦截（按店可达性校验结算）' },
        { languageCode: core_1.LanguageCode.en, value: 'Range Delivery Eligibility Checker' },
    ],
    args: {},
    init(injector) {
        connection = injector.get(core_1.TransactionalConnection);
    },
    check: async (ctx, order) => {
        if (!connection) {
            return true;
        }
        // 未设置收件区码/经纬度时不校验（常规流程放行）
        if (!(0, shipping_rules_1.hasOrderShippingCodes)(order)) {
            return true;
        }
        const shopMap = await (0, shipping_rules_1.resolveOrderShopMap)(connection, ctx, order);
        const shopIds = [...new Set(shopMap.values())];
        if (shopIds.length === 0) {
            return true;
        }
        const addr = (0, shipping_rules_1.readOrderShippingCodes)(order);
        const repo = connection.getRepository(ctx, delivery_range_entity_1.DeliveryRange);
        for (const shopId of shopIds) {
            const range = await repo.findOne({
                where: { shopId, channelId: ctx.channelId },
            });
            const res = (0, shipping_rules_1.evaluateRange)(range, shopId, addr);
            if (!res.inRange) {
                return false;
            }
        }
        return true;
    },
});
//# sourceMappingURL=range-shipping-eligibility-checker.js.map