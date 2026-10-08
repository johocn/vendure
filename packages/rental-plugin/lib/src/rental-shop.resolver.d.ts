import { ID, Order, RequestContext } from '@vendure/core';
import { RentalPlan } from './rental-plan.entity';
import { RentalService } from './rental.service';
export declare class RentalShopResolver {
    private rentalService;
    constructor(rentalService: RentalService);
    rentalPlans(ctx: RequestContext, variantId: ID): Promise<RentalPlan[]>;
    startRental(ctx: RequestContext, orderId: ID, planId: ID, periods?: number): Promise<Order>;
    buyoutRental(ctx: RequestContext, orderId: ID): Promise<{
        scheduleId: number;
        seq: number;
        amount: number;
    }>;
}
