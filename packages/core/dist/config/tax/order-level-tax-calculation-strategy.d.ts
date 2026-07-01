import { OrderTaxSummary } from '@vendure/common/lib/generated-types';
import { Order } from '../../entity/order/order.entity';
import { OrderTaxCalculationStrategy, OrderTotalsResult } from './order-tax-calculation-strategy';
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
export declare class OrderLevelTaxCalculationStrategy implements OrderTaxCalculationStrategy {
    calculateOrderTotals(order: Order): OrderTotalsResult;
    calculateTaxSummary(order: Order): OrderTaxSummary[];
    private groupOrder;
    private accumulateIntoGroups;
}
