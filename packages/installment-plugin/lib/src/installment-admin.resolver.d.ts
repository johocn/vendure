import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { InstallmentPlan } from './installment-plan.entity';
import { InstallmentService } from './installment.service';
export declare class InstallmentAdminResolver {
    private installmentService;
    constructor(installmentService: InstallmentService);
    installmentPlans(ctx: RequestContext, options?: ListQueryOptions<InstallmentPlan>): Promise<PaginatedList<InstallmentPlan>>;
    installmentPlan(ctx: RequestContext, id: ID): Promise<InstallmentPlan | undefined>;
    createInstallmentPlan(ctx: RequestContext, input: any): Promise<InstallmentPlan>;
    updateInstallmentPlan(ctx: RequestContext, input: any): Promise<InstallmentPlan>;
    deleteInstallmentPlan(ctx: RequestContext, id: ID): Promise<boolean>;
}
