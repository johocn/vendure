"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelTaxLineCalculationStrategy = void 0;
const core_1 = require("@vendure/core");
/**
 * 租户级税率开关：当 Channel.customFields.taxEnabled === false 时，订单行按「零税率」结算，
 * 即商品/购物车结算使用不含税的净价（后台录入价），与前端展示口径一致。
 * 默认 true（含税），回退到 Vendure 默认单税率计算，确保存量租户行为不变。
 *
 * 实现原理：OrderLine.taxRate = sum(taxLines.taxRate)。taxEnabled=false 时返回空 TaxLine[]，
 * 使 line 的 taxRate=0，unitPriceWithTax 退化等于净价 unitPrice，订单总额即结算价。
 */
class ChannelTaxLineCalculationStrategy {
    constructor() {
        this.defaultStrategy = new core_1.DefaultTaxLineCalculationStrategy();
    }
    calculate(args) {
        var _a, _b, _c;
        const channel = (_a = args.ctx) === null || _a === void 0 ? void 0 : _a.channel;
        const taxEnabled = (_c = (_b = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _b === void 0 ? void 0 : _b.taxEnabled) !== null && _c !== void 0 ? _c : true;
        if (taxEnabled === false) {
            return [];
        }
        return this.defaultStrategy.calculate(args);
    }
}
exports.ChannelTaxLineCalculationStrategy = ChannelTaxLineCalculationStrategy;
//# sourceMappingURL=channel-tax-line-calculation-strategy.js.map