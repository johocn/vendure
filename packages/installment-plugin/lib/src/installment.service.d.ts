import { ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { InstallmentPlan } from './installment-plan.entity';
export declare class InstallmentService {
    private connection;
    private listQueryBuilder;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    private repo;
    findAll(ctx: RequestContext, options?: ListQueryOptions<InstallmentPlan>): Promise<PaginatedList<InstallmentPlan>>;
    findByVariant(ctx: RequestContext, variantId: ID): Promise<InstallmentPlan[]>;
    findOne(ctx: RequestContext, id: ID): Promise<InstallmentPlan | undefined>;
    create(ctx: RequestContext, input: Partial<InstallmentPlan>): Promise<InstallmentPlan>;
    update(ctx: RequestContext, input: any): Promise<InstallmentPlan>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    /** 参数硬校验（设计 §5：首付比 0-90 / 期数 1-36） */
    private assertValid;
}
