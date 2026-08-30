import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { CreateCollectionInput } from '@vendure/common/lib/generated-types';
import { TenantCatalogService } from './tenant-catalog.service';

@Resolver()
export class TenantCatalogAdminResolver {
    constructor(private tenantCatalogService: TenantCatalogService) {}

    @Mutation()
    @Allow(Permission.CreateCatalog, Permission.CreateCollection)
    async createTenantCollection(
        @Ctx() ctx: RequestContext,
        @Args('input') input: CreateCollectionInput,
    ): Promise<any> {
        return this.tenantCatalogService.createTenantCollection(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, Permission.UpdateProduct)
    async mapProductToPlatformCollection(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId: string,
        @Args('collectionId') collectionId: string,
    ): Promise<boolean> {
        await this.tenantCatalogService.addProductToCollection(ctx, productId, collectionId);
        return true;
    }
}