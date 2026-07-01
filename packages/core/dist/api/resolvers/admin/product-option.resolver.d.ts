import { DeletionResponse, MutationAssignProductOptionGroupsToChannelArgs, MutationCreateProductOptionArgs, MutationCreateProductOptionGroupArgs, MutationDeleteProductOptionArgs, MutationDeleteProductOptionGroupArgs, MutationDeleteProductOptionGroupsArgs, MutationRemoveProductOptionGroupsFromChannelArgs, MutationUpdateProductOptionArgs, MutationUpdateProductOptionGroupArgs, QueryProductOptionArgs, QueryProductOptionGroupArgs, QueryProductOptionGroupsArgs, QueryProductOptionsArgs, RemoveProductOptionGroupFromChannelResult } from '@vendure/common/lib/generated-types';
import { PaginatedList } from '@vendure/common/lib/shared-types';
import { ErrorResultUnion } from '../../../common/error/error-result';
import { Translated } from '../../../common/types/locale-types';
import { ProductOptionGroup } from '../../../entity/product-option-group/product-option-group.entity';
import { ProductOption } from '../../../entity/product-option/product-option.entity';
import { ProductOptionGroupService } from '../../../service/services/product-option-group.service';
import { ProductOptionService } from '../../../service/services/product-option.service';
import { RequestContext } from '../../common/request-context';
import { RelationPaths } from '../../decorators/relations.decorator';
export declare class ProductOptionResolver {
    private productOptionGroupService;
    private productOptionService;
    constructor(productOptionGroupService: ProductOptionGroupService, productOptionService: ProductOptionService);
    productOptionGroups(ctx: RequestContext, args: QueryProductOptionGroupsArgs, relations: RelationPaths<ProductOptionGroup>): Promise<PaginatedList<Translated<ProductOptionGroup>>>;
    productOptionGroup(ctx: RequestContext, args: QueryProductOptionGroupArgs, relations: RelationPaths<ProductOptionGroup>): Promise<Translated<ProductOptionGroup> | undefined>;
    createProductOptionGroup(ctx: RequestContext, args: MutationCreateProductOptionGroupArgs): Promise<Translated<ProductOptionGroup>>;
    updateProductOptionGroup(ctx: RequestContext, args: MutationUpdateProductOptionGroupArgs): Promise<Translated<ProductOptionGroup>>;
    deleteProductOptionGroup(ctx: RequestContext, args: MutationDeleteProductOptionGroupArgs): Promise<DeletionResponse>;
    deleteProductOptionGroups(ctx: RequestContext, args: MutationDeleteProductOptionGroupsArgs): Promise<DeletionResponse[]>;
    productOption(ctx: RequestContext, args: QueryProductOptionArgs, relations: RelationPaths<ProductOption>): Promise<Translated<ProductOption> | undefined>;
    productOptions(ctx: RequestContext, args: QueryProductOptionsArgs, relations: RelationPaths<ProductOption>): Promise<PaginatedList<Translated<ProductOption>>>;
    createProductOption(ctx: RequestContext, args: MutationCreateProductOptionArgs): Promise<Translated<ProductOption>>;
    updateProductOption(ctx: RequestContext, args: MutationUpdateProductOptionArgs): Promise<Translated<ProductOption>>;
    deleteProductOption(ctx: RequestContext, { id }: MutationDeleteProductOptionArgs): Promise<DeletionResponse>;
    assignProductOptionGroupsToChannel(ctx: RequestContext, args: MutationAssignProductOptionGroupsToChannelArgs): Promise<Array<Translated<ProductOptionGroup>>>;
    removeProductOptionGroupsFromChannel(ctx: RequestContext, args: MutationRemoveProductOptionGroupsFromChannelArgs): Promise<Array<ErrorResultUnion<RemoveProductOptionGroupFromChannelResult, ProductOptionGroup>>>;
}
