import { ID, PaginatedList, ListQueryOptions, RequestContext, TransactionalConnection } from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';
export declare class PickupLocationService {
    private connection;
    constructor(connection: TransactionalConnection);
    findAll(ctx: RequestContext, options?: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>>;
    findOne(ctx: RequestContext, id: ID): Promise<PickupLocation | undefined>;
    findByType(ctx: RequestContext, type: string): Promise<PickupLocation[]>;
    /**
     * 按城市动态聚合当前渠道可见的启用自提点（rangeMode='all' 用）。
     * 语义：可见规则(公共点+本租户自建点) + 类型匹配 + enabled=true + 同 city + channels 关联当前渠道。
     * city 可为空 → 聚合当前渠道全部可见且启用的同类型自提点。
     */
    findByCityForChannel(ctx: RequestContext, city: string | null, type: string): Promise<PickupLocation[]>;
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
