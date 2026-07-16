import { ID, PaginatedList, ListQueryOptions, RequestContext, TransactionalConnection } from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';
export declare class PickupLocationService {
    private connection;
    constructor(connection: TransactionalConnection);
    findAll(ctx: RequestContext, options?: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>>;
    findOne(ctx: RequestContext, id: ID): Promise<PickupLocation | undefined>;
    findByType(ctx: RequestContext, type: string): Promise<PickupLocation[]>;
    findByIds(ctx: RequestContext, ids: ID[]): Promise<PickupLocation[]>;
    create(ctx: RequestContext, input: any): Promise<PickupLocation>;
    update(ctx: RequestContext, input: any): Promise<PickupLocation>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    promoteToPublic(ctx: RequestContext, id: ID): Promise<PickupLocation>;
    assignToChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void>;
    removeFromChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void>;
    sortByDistance(locations: PickupLocation[], lat: number, lng: number): Promise<PickupLocation[]>;
    private haversineDistance;
}
