import { AssignStockLocationsToChannelInput, CreateStockLocationInput, DeleteStockLocationInput, DeletionResponse, RemoveStockLocationsFromChannelInput, UpdateStockLocationInput } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import { RequestContext } from '../../api/common/request-context';
import { RelationPaths } from '../../api/decorators/relations.decorator';
import { RequestContextCacheService } from '../../cache/request-context-cache.service';
import { ListQueryOptions } from '../../common/types/common-types';
import { ConfigService } from '../../config/config.service';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { OrderLine } from '../../entity/order-line/order-line.entity';
import { StockLocation } from '../../entity/stock-location/stock-location.entity';
import { EventBus } from '../../event-bus/index';
import { CustomFieldRelationService } from '../helpers/custom-field-relation/custom-field-relation.service';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { RequestContextService } from '../helpers/request-context/request-context.service';
import { ChannelService } from './channel.service';
import { RoleService } from './role.service';
/**
 * @description
 * Contains methods relating to {@link StockLocation} entities.
 *
 * @docsCategory services
 */
export declare class StockLocationService {
    private requestContextService;
    private connection;
    private channelService;
    private roleService;
    private listQueryBuilder;
    private configService;
    private requestContextCache;
    private customFieldRelationService;
    private eventBus;
    constructor(requestContextService: RequestContextService, connection: TransactionalConnection, channelService: ChannelService, roleService: RoleService, listQueryBuilder: ListQueryBuilder, configService: ConfigService, requestContextCache: RequestContextCacheService, customFieldRelationService: CustomFieldRelationService, eventBus: EventBus);
    initStockLocations(): Promise<void>;
    findOne(ctx: RequestContext, stockLocationId: ID): Promise<StockLocation | undefined>;
    findAll(ctx: RequestContext, options?: ListQueryOptions<StockLocation>, relations?: RelationPaths<StockLocation>): Promise<PaginatedList<StockLocation>>;
    create(ctx: RequestContext, input: CreateStockLocationInput): Promise<StockLocation>;
    update(ctx: RequestContext, input: UpdateStockLocationInput): Promise<StockLocation>;
    /**
     * @description
     * Deletes a StockLocation. If `transferToLocationId` is specified in the input, all stock levels
     * from the deleted location will be transferred to the target location. The last StockLocation
     * cannot be deleted.
     */
    delete(ctx: RequestContext, input: DeleteStockLocationInput): Promise<DeletionResponse>;
    /**
     * @description
     * Assigns multiple StockLocations to the specified Channel. Requires the `UpdateStockLocation`
     * permission on the target channel.
     */
    assignStockLocationsToChannel(ctx: RequestContext, input: AssignStockLocationsToChannelInput): Promise<StockLocation[]>;
    /**
     * @description
     * Removes multiple StockLocations from the specified Channel. Requires the `DeleteStockLocation`
     * permission on the target channel. StockLocations cannot be removed from the default channel.
     */
    removeStockLocationsFromChannel(ctx: RequestContext, input: RemoveStockLocationsFromChannelInput): Promise<StockLocation[]>;
    private getAllStockLocations;
    defaultStockLocation(ctx: RequestContext): Promise<StockLocation>;
    /**
     * @description
     * Returns the locations and quantities to use for allocating stock when an OrderLine is created.
     * This uses the configured {@link StockLocationStrategy}.
     */
    getAllocationLocations(ctx: RequestContext, orderLine: OrderLine, quantity: number): Promise<import("../..").LocationWithQuantity[]>;
    /**
     * @description
     * Returns the locations and quantities to use for releasing allocated stock when an OrderLine is cancelled
     * or modified. This uses the configured {@link StockLocationStrategy}.
     */
    getReleaseLocations(ctx: RequestContext, orderLine: OrderLine, quantity: number): Promise<import("../..").LocationWithQuantity[]>;
    /**
     * @description
     * Returns the locations and quantities to use for creating sales when an Order is fulfilled.
     * This uses the configured {@link StockLocationStrategy}.
     */
    getSaleLocations(ctx: RequestContext, orderLine: OrderLine, quantity: number): Promise<import("../..").LocationWithQuantity[]>;
    /**
     * @description
     * Returns the locations and quantities to use for cancelling sales when an OrderLine is cancelled
     * after fulfillment. This uses the configured {@link StockLocationStrategy}.
     */
    getCancellationLocations(ctx: RequestContext, orderLine: OrderLine, quantity: number): Promise<import("../..").LocationWithQuantity[]>;
    private ensureDefaultStockLocationExists;
}
