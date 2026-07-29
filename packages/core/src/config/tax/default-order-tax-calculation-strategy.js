"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultOrderTaxCalculationStrategy = void 0;
const shared_utils_1 = require("@vendure/common/lib/shared-utils");
const order_line_entity_1 = require("../../entity/order-line/order-line.entity");
const surcharge_entity_1 = require("../../entity/surcharge/surcharge.entity");
/**
 * @description
 * The default {@link OrderTaxCalculationStrategy}. Tax is rounded at the
 * individual line level and then summed. This matches the standard Vendure behaviour
 * prior to the introduction of this strategy.
 *
 * @docsCategory tax
 * @docsPage OrderTaxCalculationStrategy
 * @since 3.6.0
 */
class DefaultOrderTaxCalculationStrategy {
    calculateOrderTotals(order) {
        var _a, _b, _c;
        let subTotal = 0;
        let subTotalWithTax = 0;
        for (const line of (_a = order.lines) !== null && _a !== void 0 ? _a : []) {
            subTotal += line.proratedLinePrice;
            subTotalWithTax += line.proratedLinePriceWithTax;
        }
        for (const surcharge of (_b = order.surcharges) !== null && _b !== void 0 ? _b : []) {
            subTotal += surcharge.price;
            subTotalWithTax += surcharge.priceWithTax;
        }
        let shipping = 0;
        let shippingWithTax = 0;
        for (const shippingLine of (_c = order.shippingLines) !== null && _c !== void 0 ? _c : []) {
            shipping += shippingLine.discountedPrice;
            shippingWithTax += shippingLine.discountedPriceWithTax;
        }
        return { subTotal, subTotalWithTax, shipping, shippingWithTax };
    }
    calculateTaxSummary(order) {
        var _a, _b, _c, _d;
        const taxRateMap = new Map();
        const taxId = (taxLine) => `${taxLine.description}:${taxLine.taxRate}`;
        const taxableLines = [
            ...((_a = order.lines) !== null && _a !== void 0 ? _a : []),
            ...((_b = order.shippingLines) !== null && _b !== void 0 ? _b : []),
            ...((_c = order.surcharges) !== null && _c !== void 0 ? _c : []),
        ];
        for (const line of taxableLines) {
            if (!((_d = line.taxLines) === null || _d === void 0 ? void 0 : _d.length)) {
                continue;
            }
            const taxRateTotal = (0, shared_utils_1.summate)(line.taxLines, 'taxRate');
            for (const taxLine of line.taxLines) {
                const id = taxId(taxLine);
                const row = taxRateMap.get(id);
                const proportionOfTotalRate = 0 < taxLine.taxRate ? taxLine.taxRate / taxRateTotal : 0;
                const lineBase = line instanceof order_line_entity_1.OrderLine
                    ? line.proratedLinePrice
                    : line instanceof surcharge_entity_1.Surcharge
                        ? line.price
                        : line.discountedPrice;
                const lineWithTax = line instanceof order_line_entity_1.OrderLine
                    ? line.proratedLinePriceWithTax
                    : line instanceof surcharge_entity_1.Surcharge
                        ? line.priceWithTax
                        : line.discountedPriceWithTax;
                const amount = Math.round((lineWithTax - lineBase) * proportionOfTotalRate);
                if (row) {
                    row.tax += amount;
                    row.base += lineBase;
                }
                else {
                    taxRateMap.set(id, {
                        tax: amount,
                        base: lineBase,
                        description: taxLine.description,
                        rate: taxLine.taxRate,
                    });
                }
            }
        }
        return Array.from(taxRateMap.entries()).map(([, row]) => ({
            taxRate: row.rate,
            description: row.description,
            taxBase: row.base,
            taxTotal: row.tax,
        }));
    }
}
exports.DefaultOrderTaxCalculationStrategy = DefaultOrderTaxCalculationStrategy;
//# sourceMappingURL=default-order-tax-calculation-strategy.js.map