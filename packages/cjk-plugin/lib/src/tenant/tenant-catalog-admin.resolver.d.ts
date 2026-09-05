import { RequestContext } from '@vendure/core';
import { CreateCollectionInput } from '@vendure/common/lib/generated-types';
import { TenantCatalogService } from './tenant-catalog.service';
import { TenantOptionGroupService } from './tenant-option-group.service';
export declare class TenantCatalogAdminResolver {
    private tenantCatalogService;
    private optionGroupService;
    constructor(tenantCatalogService: TenantCatalogService, optionGroupService: TenantOptionGroupService);
    createTenantCollection(ctx: RequestContext, input: CreateCollectionInput): Promise<any>;
    mapProductToPlatformCollection(ctx: RequestContext, productId: string, collectionId: string): Promise<boolean>;
    moveProductsToTenantChannel(ctx: RequestContext, productIds: string[], channelId: string): Promise<number>;
    reusableOptionGroups(ctx: RequestContext): Promise<any>;
    reuseOptionGroupForProduct(productId: string, optionGroupId: string): Promise<boolean>;
}
