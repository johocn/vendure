import { ShippingEligibilityChecker } from '@vendure/core';
/**
 * @description
 * Shipping method is eligible if at least one OrderLine is associated with the Seller's Channel.
 */
export declare const multivendorShippingEligibilityChecker: ShippingEligibilityChecker<{}>;
