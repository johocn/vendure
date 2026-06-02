import { RequestContext, TransactionalConnection, ID, PaginatedList, ListQueryOptions, ChannelService } from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';
export declare class PickupLocationService {
    private connection;
    private channelService;
    constructor(connection: TransactionalConnection, channelService: ChannelService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>>;
    findOne(ctx: RequestContext, id: ID): Promise<PickupLocation | undefined>;
    create(ctx: RequestContext, input: any): Promise<PickupLocation>;
    update(ctx: RequestContext, input: any): Promise<PickupLocation>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
}
