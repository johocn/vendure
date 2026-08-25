import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { MarketplaceProductService, MarketplaceProductView } from './marketplace-product.service';
import { platformProductReviewPermission } from './marketplace-permissions';

@Resolver()
export class MarketplaceProductResolver {
    constructor(private service: MarketplaceProductService) {}

    @Mutation()
    @Allow(Permission.SuperAdmin, platformProductReviewPermission.Permission)
    async submitProductToMarketplace(@Ctx() ctx: RequestContext, @Args('id', { type: () => String }) id: string): Promise<MarketplaceProductView> {
        await this.service.submitToMarketplace(ctx, id);
        return this.service.findOneView(ctx, id);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin, platformProductReviewPermission.Permission)
    async reviewMarketplaceProduct(
        @Ctx() ctx: RequestContext,
        @Args('id', { type: () => String }) id: string,
        @Args('approve', { type: () => Boolean }) approve: boolean,
        @Args('rejectReason', { type: () => String, nullable: true }) rejectReason?: string | null,
    ): Promise<MarketplaceProductView> {
        await this.service.review(ctx, id, approve, rejectReason);
        return this.service.findOneView(ctx, id);
    }

    @Query()
    @Allow(Permission.SuperAdmin, platformProductReviewPermission.Permission)
    async marketplaceProducts(
        @Ctx() ctx: RequestContext,
        @Args('status', { type: () => String, nullable: true }) status?: string | null,
    ): Promise<MarketplaceProductView[]> {
        return this.service.findByStatus(ctx, status);
    }
}