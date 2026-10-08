import { ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { RentalPlan } from './rental-plan.entity';
export declare class RentalService {
    private connection;
    private listQueryBuilder;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    private repo;
    findAll(ctx: RequestContext, options?: ListQueryOptions<RentalPlan>): Promise<PaginatedList<RentalPlan>>;
    findByVariant(ctx: RequestContext, variantId: ID): Promise<RentalPlan[]>;
    findOne(ctx: RequestContext, id: ID): Promise<RentalPlan | undefined>;
    create(ctx: RequestContext, input: Partial<RentalPlan>): Promise<RentalPlan>;
    update(ctx: RequestContext, input: any): Promise<RentalPlan>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    /** 参数硬校验（押金/租金必须为正；买断价可为 null 但不可为负） */
    private assertValid;
}
