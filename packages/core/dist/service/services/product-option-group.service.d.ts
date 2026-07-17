import { AssignProductOptionGroupsToChannelInput, CreateProductOptionGroupInput, DeletionResponse, DeletionResult, RemoveProductOptionGroupFromChannelResult, RemoveProductOptionGroupsFromChannelInput, UpdateProductOptionGroupInput } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import { RequestContext } from '../../api/common/request-context';
import { RelationPaths } from '../../api/decorators/relations.decorator';
import { ErrorResultUnion } from '../../common';
import { ListQueryOptions } from '../../common/types/common-types';
import { Translated } from '../../common/types/locale-types';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { Channel } from '../../entity/channel/channel.entity';
import { ProductOptionGroup } from '../../entity/product-option-group/product-option-group.entity';
import { EventBus } from '../../event-bus';
import { CustomFieldRelationService } from '../helpers/custom-field-relation/custom-field-relation.service';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { TranslatableSaver } from '../helpers/translatable-saver/translatable-saver';
import { TranslatorService } from '../helpers/translator/translator.service';
import { ChannelService } from './channel.service';
import { ProductOptionService } from './product-option.service';
import { RoleService } from './role.service';
/**
 * @description
 * Contains methods relating to {@link ProductOptionGroup} entities.
 *
 * @docsCategory services
 */
export declare class ProductOptionGroupService {
    private connection;
    private translatableSaver;
    private customFieldRelationService;
    private productOptionService;
    private eventBus;
    private translator;
    private listQueryBuilder;
    private channelService;
    private roleService;
    constructor(connection: TransactionalConnection, translatableSaver: TranslatableSaver, customFieldRelationService: CustomFieldRelationService, productOptionService: ProductOptionService, eventBus: EventBus, translator: TranslatorService, listQueryBuilder: ListQueryBuilder, channelService: ChannelService, roleService: RoleService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<ProductOptionGroup>, relations?: RelationPaths<ProductOptionGroup>): Promise<PaginatedList<Translated<ProductOptionGroup>>>;
    findOne(ctx: RequestContext, id: ID, relations?: RelationPaths<ProductOptionGroup>, findOneOptions?: {
        includeSoftDeleted: boolean;
    }): Promise<Translated<ProductOptionGroup> | undefined>;
    getOptionGroupsByProductId(ctx: RequestContext, id: ID): Promise<Array<Translated<ProductOptionGroup>>>;
    /**
     * @description
     * Returns all Channels to which the ProductOptionGroup is assigned.
     */
    getOptionGroupChannels(ctx: RequestContext, optionGroupId: ID): Promise<Channel[]>;
    /**
     * @description
     * Returns the number of non-deleted Products in the current channel
     * that use the given ProductOptionGroup.
     */
    getProductCount(ctx: RequestContext, optionGroupId: ID): Promise<number>;
    create(ctx: RequestContext, input: Omit<CreateProductOptionGroupInput, 'options'>): Promise<Translated<ProductOptionGroup>>;
    update(ctx: RequestContext, input: UpdateProductOptionGroupInput): Promise<Translated<ProductOptionGroup>>;
    /**
     * @description
     * Deletes a ProductOptionGroup. If the group is in use by any Products, the deletion
     * will fail unless `force` is set to `true`.
     */
    delete(ctx: RequestContext, id: ID, force?: boolean): Promise<DeletionResponse>;
    /**
     * @description
     * Deletes the ProductOptionGroup and any associated ProductOptions. If the ProductOptionGroup
     * is still referenced by a soft-deleted Product, then a soft-delete will be used to preserve
     * referential integrity. Otherwise a hard-delete will be performed.
     *
     * @deprecated Use {@link ProductOptionGroupService.delete} instead.
     */
    deleteGroupAndOptionsFromProduct(ctx: RequestContext, id: ID, productId: ID): Promise<{
        result: DeletionResult;
        message: string;
    } | {
        result: DeletionResult.NOT_DELETED;
        message: string | undefined;
    } | {
        result: DeletionResult;
        message?: undefined;
    }>;
    /**
     * @description
     * Assigns ProductOptionGroups to the specified Channel
     */
    assignProductOptionGroupsToChannel(ctx: RequestContext, input: AssignProductOptionGroupsToChannelInput): Promise<Array<Translated<ProductOptionGroup>>>;
    /**
     * @description
     * Removes ProductOptionGroups from the specified Channel
     */
    removeProductOptionGroupsFromChannel(ctx: RequestContext, input: RemoveProductOptionGroupsFromChannelInput): Promise<Array<ErrorResultUnion<RemoveProductOptionGroupFromChannelResult, Translated<ProductOptionGroup>>>>;
    private isInUseByOtherProducts;
    private groupOptionsAreInUse;
}
