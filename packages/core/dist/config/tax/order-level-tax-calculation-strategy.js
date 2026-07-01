"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderLevelTaxCalculationStrategy = void 0;
const tax_utils_1 = require("../../common/tax-utils");
/**
 * @description
 * An {@link OrderTaxCalculationStrategy} that groups net subtotals by tax rate
 * and rounds once per group. This eliminates per-line rounding accumulation errors
 * present in the {@link DefaultOrderTaxCalculationStrategy}.
 *
 * This approach is required by certain jurisdictions and ERP systems that expect
 * tax to be calculated on the subtotal per tax rate rather than per line.
 *
 * Note that when using this strategy, the `taxTotal` in the tax summary may differ
 * by ±1 minor unit from the sum of individual line-level `proratedLineTax` values.
 * This is expected and is the intended behaviour.
 *
 * @example
 * ```ts
 * import { OrderLevelTaxCalculationStrategy, VendureConfig } from '\@vendure/core';
 *
 * export const config: VendureConfig = {
 *   taxOptions: {
 *     orderTaxCalculationStrategy: new OrderLevelTaxCalculationStrategy(),
 *   },
 * };
 * ```
 *
 * @docsCategory tax
 * @docsPage OrderTaxCalculationStrategy
 * @since 3.6.0
 */
class OrderLevelTaxCalculationStrategy {
    calculateOrderTotals(order) {
        const { subTotal, subTotalGroups, shipping, shippingGroups } = this.groupOrder(order);
        let subTotalTax = 0;
        for (const [, group] of subTotalGroups) {
            subTotalTax += Math.round((0, tax_utils_1.taxPayableOn)(group.netBase, group.rate));
        }
        let shippingTax = 0;
        for (const [, group] of shippingGroups) {
            shippingTax += Math.round((0, tax_utils_1.taxPayableOn)(group.netBase, group.rate));
        }
        return {
            subTotal,
            subTotalWithTax: subTotal + subTotalTax,
            shipping,
            shippingWithTax: shipping + shippingTax,
        };
    }
    calculateTaxSummary(order) {
        const { subTotalGroups, shippingGroups } = this.groupOrder(order);
        const merged = new Map();
        for (const groups of [subTotalGroups, shippingGroups]) {
            for (const [key, group] of groups) {
                const roundedTax = Math.round((0, tax_utils_1.taxPayableOn)(group.netBase, group.rate));
                const existing = merged.get(key);
                if (existing) {
                    existing.netBase += group.netBase;
                    existing.tax += roundedTax;
                }
                else {
                    merged.set(key, Object.assign(Object.assign({}, group), { tax: roundedTax }));
                }
            }
        }
        const taxSummary = [];
        for (const [, group] of merged) {
            taxSummary.push({
                taxRate: group.rate,
                description: group.description,
                taxBase: group.netBase,
                taxTotal: group.tax,
            });
        }
        return taxSummary;
    }
    groupOrder(order) {
        var _a, _b, _c;
        let subTotal = 0;
        let shipping = 0;
        const subTotalGroups = new Map();
        const shippingGroups = new Map();
        for (const line of (_a = order.lines) !== null && _a !== void 0 ? _a : []) {
            subTotal += line.proratedLinePrice;
            this.accumulateIntoGroups(subTotalGroups, line.taxLines, line.proratedLinePrice);
        }
        for (const surcharge of (_b = order.surcharges) !== null && _b !== void 0 ? _b : []) {
            subTotal += surcharge.price;
            this.accumulateIntoGroups(subTotalGroups, surcharge.taxLines, surcharge.price);
        }
        for (const shippingLine of (_c = order.shippingLines) !== null && _c !== void 0 ? _c : []) {
            shipping += shippingLine.discountedPrice;
            this.accumulateIntoGroups(shippingGroups, shippingLine.taxLines, shippingLine.discountedPrice);
        }
        return { subTotal, subTotalGroups, shipping, shippingGroups };
    }
    accumulateIntoGroups(groups, taxLines, lineNetBase) {
        if (!(taxLines === null || taxLines === void 0 ? void 0 : taxLines.length)) {
            return;
        }
        for (const taxLine of taxLines) {
            const key = `${taxLine.description}:${taxLine.taxRate}`;
            const existing = groups.get(key);
            if (existing) {
                existing.netBase += lineNetBase;
            }
            else {
                groups.set(key, {
                    rate: taxLine.taxRate,
                    description: taxLine.description,
                    netBase: lineNetBase,
                });
            }
        }
    }
}
exports.OrderLevelTaxCalculationStrategy = OrderLevelTaxCalculationStrategy;
//# sourceMappingURL=order-level-tax-calculation-strategy.js.map