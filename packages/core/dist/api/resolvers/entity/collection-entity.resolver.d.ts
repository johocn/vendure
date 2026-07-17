import { CollectionBreadcrumb, ConfigurableOperation, ProductVariantListOptions } from '@vendure/common/lib/generated-types';
import { PaginatedList } from '@vendure/common/lib/shared-types';
import { RequestContextCacheService } from '../../../cache/request-context-cache.service';
import { Translated } from '../../../common/types/locale-types';
import { Asset, Collection, ProductVariant } from '../../../entity';
import { LocaleStringHydrator } from '../../../service/helpers/locale-string-hydrator/locale-string-hydrator';
import { AssetService } from '../../../service/services/asset.service';
import { CollectionService } from '../../../service/services/collection.service';
import { ProductVariantService } from '../../../service/services/product-variant.service';
import { ConfigurableOperationCodec } from '../../common/configurable-operation-codec';
import { ApiType } from '../../common/get-api-type';
import { RequestContext } from '../../common/request-context';
import { RelationPaths } from '../../decorators/relations.decorator';
export declare class CollectionEntityResolver {
    private productVariantService;
    private collectionService;
    private assetService;
    private localeStringHydrator;
    private configurableOperationCodec;
    private requestContextCache;
    constructor(productVariantService: ProductVariantService, collectionService: CollectionService, assetService: AssetService, localeStringHydrator: LocaleStringHydrator, configurableOperationCodec: ConfigurableOperationCodec, requestContextCache: RequestContextCacheService);
    name(ctx: RequestContext, collection: Collection): Promise<string>;
    slug(ctx: RequestContext, collection: Collection): Promise<string>;
    description(ctx: RequestContext, collection: Collection): Promise<string>;
    languageCode(ctx: RequestContext, collection: Collection): Promise<string>;
    productVariants(ctx: RequestContext, collection: Collection, args: {
        options: ProductVariantListOptions;
    }, apiType: ApiType, relations: RelationPaths<ProductVariant>): Promise<PaginatedList<Translated<ProductVariant>>>;
    productVariantCount(ctx: RequestContext, collection: Collection): Promise<number>;
    breadcrumbs(ctx: RequestContext, collection: Collection): Promise<CollectionBreadcrumb[]>;
    parent(ctx: RequestContext, collection: Collection, apiType: ApiType): Promise<Collection | undefined>;
    children(ctx: RequestContext, collection: Collection, apiType: ApiType): Promise<Collection[]>;
    featuredAsset(ctx: RequestContext, collection: Collection): Promise<Asset | undefined>;
    assets(ctx: RequestContext, collection: Collection): Promise<Asset[] | undefined>;
    filters(ctx: RequestContext, collection: Collection): ConfigurableOperation[];
}
