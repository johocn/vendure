import { RequestContext } from '@vendure/core';
import { CreateCollectionInput } from '@vendure/common/lib/generated-types';
import { TenantCatalogService } from './tenant-catalog.service';
export declare class TenantCatalogAdminResolver {
    private tenantCatalogService;
    constructor(tenantCatalogService: TenantCatalogService);
    createTenantCollection(ctx: RequestContext, input: CreateCollectionInput): Promise<any>;
    mapProductToPlatformCollection(ctx: RequestContext, productId: string, collectionId: string): Promise<boolean>;
}
