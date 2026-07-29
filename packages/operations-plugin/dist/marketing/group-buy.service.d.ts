import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { GroupBuyService } from '@vendure/group-buy-plugin';
export declare class GroupBuyMarketingService {
    private groupBuyService;
    constructor(groupBuyService: GroupBuyService);
    private assertPermission;
    findAll(ctx: RequestContext, options?: ListQueryOptions<any>): Promise<PaginatedList<any>>;
    findOne(ctx: RequestContext, id: ID): Promise<any | undefined>;
    create(ctx: RequestContext, input: any): Promise<any>;
    update(ctx: RequestContext, input: any): Promise<any>;
    delete(ctx: RequestContext, id: ID): Promise<boolean>;
}
