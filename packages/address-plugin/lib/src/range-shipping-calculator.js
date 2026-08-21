"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rangeShippingCalculator = void 0;
const core_1 = require("@vendure/core");
const shipping_rules_1 = require("./shipping-rules");
/** init 注入的连接（供按店读取运费档位）。 */
let connection;
/**
 * 按店运费计价：读订单行 → 商品所属 ShopId 反查，按店聚合小计，
 * 每店读取 DeliveryRange.baseFee / freeThreshold：小计 ≥ freeThreshold 即包邮(0)，否则收 baseFee。
 * 合计为订单运费；明细写入 metadata.shops 供前端「运费明细」展示。
 */
exports.rangeShippingCalculator = new core_1.ShippingCalculator({
    code: 'range-shipping',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '按店运费（基础运费 / 满额包邮）' },
        { languageCode: core_1.LanguageCode.en, value: 'Per-Shop Range Shipping Calculator' },
    ],
    args: {},
    init(injector) {
        connection = injector.get(core_1.TransactionalConnection);
    },
    calculate: async (ctx, order, args) => {
        var _a, _b;
        if (!connection || !order || !((_b = (_a = order.lines) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0)) {
            return { price: 0, priceIncludesTax: true, taxRate: 0 };
        }
        const fees = await (0, shipping_rules_1.computeShopFees)(connection, ctx, order);
        const total = fees.reduce((sum, f) => sum + f.fee, 0);
        return {
            price: total,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: { shops: fees },
        };
    },
});
//# sourceMappingURL=range-shipping-calculator.js.map