import { OrderTaxSummary } from '@vendure/common/lib/generated-types';
import { Order } from '../../entity/order/order.entity';
import { OrderTaxCalculationStrategy, OrderTotalsResult } from './order-tax-calculation-strategy';
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
export declare class DefaultOrderTaxCalculationStrategy implements OrderTaxCalculationStrategy {
    calculateOrderTotals(order: Order): OrderTotalsResult;
    calculateTaxSummary(order: Order): OrderTaxSummary[];
}
