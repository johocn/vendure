import { CreateGroupOptionInput, CreateProductOptionInput, DeletionResponse, UpdateProductOptionInput } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import { RelationPaths } from '../../api';
import { RequestContext } from '../../api/common/request-context';
import { ListQueryOptions } from '../../common';
import { Translated } from '../../common/types/locale-types';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { ProductOptionGroup } from '../../entity/product-option-group/product-option-group.entity';
import { ProductOption } from '../../entity/product-option/product-option.entity';
import { EventBus } from '../../event-bus';
import { CustomFieldRelationService } from '../helpers/custom-field-relation/custom-field-relation.service';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { TranslatableSaver } from '../helpers/translatable-saver/translatable-saver';
import { TranslatorService } from '../helpers/translator/translator.service';
import { ChannelService } from './channel.service';
/**
 * @description
 * Contains methods relating to {@link ProductOption} entities.
 *
 * @docsCategory services
 */
export declare class ProductOptionService {
    private connection;
    private translatableSaver;
    private customFieldRelationService;
    private eventBus;
    private translator;
    private listQueryBuilder;
    private channelService;
    constructor(connection: TransactionalConnection, translatableSaver: TranslatableSaver, customFieldRelationService: CustomFieldRelationService, eventBus: EventBus, translator: TranslatorService, listQueryBuilder: ListQueryBuilder, channelService: ChannelService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<ProductOption>, groupId?: ID, relations?: RelationPaths<ProductOption>): Promise<PaginatedList<Translated<ProductOption>>>;
    findOne(ctx: RequestContext, id: ID, relations?: RelationPaths<ProductOption>): Promise<Translated<ProductOption> | undefined>;
    create(ctx: RequestContext, group: ProductOptionGroup | ID, input: CreateGroupOptionInput | CreateProductOptionInput): Promise<Translated<ProductOption>>;
    update(ctx: RequestContext, input: UpdateProductOptionInput): Promise<Translated<ProductOption>>;
    /**
     * @description
     * Deletes a ProductOption.
     *
     * - If the ProductOption is used by any ProductVariants, the deletion will fail.
     * - If the ProductOption is used only by soft-deleted ProductVariants, the option will itself
     *   be soft-deleted.
     * - If the ProductOption is not used by any ProductVariant at all, it will be hard-deleted.
     */
    delete(ctx: RequestContext, id: ID): Promise<DeletionResponse>;
    private isInUse;
}
