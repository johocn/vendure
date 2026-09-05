import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { CreateCollectionInput } from '@vendure/common/lib/generated-types';
import { TenantCatalogService } from './tenant-catalog.service';
import { TenantOptionGroupService } from './tenant-option-group.service';

@Resolver()
export class TenantCatalogAdminResolver {
    constructor(
        private tenantCatalogService: TenantCatalogService,
        private optionGroupService: TenantOptionGroupService,
    ) {}

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

    @Mutation()
    @Allow(Permission.UpdateCatalog, Permission.UpdateProduct)
    async moveProductsToTenantChannel(
        @Ctx() ctx: RequestContext,
        @Args('productIds') productIds: string[],
        @Args('channelId') channelId: string,
    ): Promise<number> {
        const moved = await this.tenantCatalogService.moveProductsToTenantChannel(
            ctx,
            productIds,
            channelId,
        );
        return moved.length;
    }

    @Query()
    @Allow(Permission.ReadCatalog, Permission.ReadProduct)
    async reusableOptionGroups(@Ctx() ctx: RequestContext): Promise<any> {
        return this.optionGroupService.reusableOptionGroups(ctx);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, Permission.UpdateProduct)
    async reuseOptionGroupForProduct(
        @Args('productId') productId: string,
        @Args('optionGroupId') optionGroupId: string,
    ): Promise<boolean> {
        return this.optionGroupService.reuseOptionGroupForProduct(productId, optionGroupId);
    }
}