import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { MarketplaceService } from '../marketplace.service';

@Resolver()
export class AdminMarketplaceResolver {
    constructor(private marketplaceService: MarketplaceService) {}

    @Mutation('approveMarketplaceProduct')
    @Transaction()
    @Allow(Permission.UpdateProduct, Permission.SuperAdmin)
    async approveMarketplaceProduct(
        @Ctx() ctx: RequestContext,
        @Args() args: { productId: string },
    ): Promise<boolean> {
        await this.marketplaceService.approveMarketplaceProduct(ctx, args.productId);
        return true;
    }

    @Mutation('rejectMarketplaceProduct')
    @Transaction()
    @Allow(Permission.UpdateProduct, Permission.SuperAdmin)
    async rejectMarketplaceProduct(
        @Ctx() ctx: RequestContext,
        @Args() args: { productId: string; reason: string },
    ): Promise<boolean> {
        await this.marketplaceService.rejectMarketplaceProduct(ctx, args.productId, args.reason);
        return true;
    }

    @Query('marketplacePendingProducts')
    @Allow(Permission.ReadProduct, Permission.SuperAdmin)
    async marketplacePendingProducts(@Ctx() ctx: RequestContext) {
        const products = await this.marketplaceService.getPendingProducts(ctx);
        return products as any;
    }
}