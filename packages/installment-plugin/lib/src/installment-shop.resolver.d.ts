import { ID, Order, RequestContext } from '@vendure/core';
import { InstallmentPlan } from './installment-plan.entity';
import { InstallmentService } from './installment.service';
export declare class InstallmentShopResolver {
    private installmentService;
    constructor(installmentService: InstallmentService);
    installmentPlans(ctx: RequestContext, variantId: ID): Promise<InstallmentPlan[]>;
    enableInstallment(ctx: RequestContext, orderId: ID, planId: ID): Promise<Order>;
}
