import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { RentalPlan } from './rental-plan.entity';
import { RentalService } from './rental.service';
export declare class RentalAdminResolver {
    private rentalService;
    constructor(rentalService: RentalService);
    rentalPlans(ctx: RequestContext, options?: ListQueryOptions<RentalPlan>): Promise<PaginatedList<RentalPlan>>;
    rentalPlan(ctx: RequestContext, id: ID): Promise<RentalPlan | undefined>;
    createRentalPlan(ctx: RequestContext, input: any): Promise<RentalPlan>;
    updateRentalPlan(ctx: RequestContext, input: any): Promise<RentalPlan>;
    deleteRentalPlan(ctx: RequestContext, id: ID): Promise<boolean>;
}
