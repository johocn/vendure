import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, InternalServerError, Permission, RequestContext, Transaction } from '@vendure/core';

import { MarketplaceSellerService } from '../marketplace-seller-service';
import { MarketplaceService } from '../marketplace.service';
import { CreateSellerInput } from '../types';

@Resolver()
export class ShopResolver {
    constructor(
        private marketplaceSellerService: MarketplaceSellerService,
        private marketplaceService: MarketplaceService,
    ) {}

    @Mutation('registerMarketplaceSeller')
    @Transaction()
    @Allow(Permission.Public)
    async registerMarketplaceSeller(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: { shopName: string; seller: CreateSellerInput } },
    ) {
        try {
            const channel = await this.marketplaceSellerService.registerMarketplaceSeller(ctx, args.input);
            return {
                id: channel.id,
                code: channel.code,
                token: channel.token,
            };
        } catch (e) {
            if (e instanceof InternalServerError) {
                return { errorCode: 'INTERNAL_SERVER_ERROR', message: e.message };
            }
            throw e;
        }
    }

    @Query('marketplaceProducts')
    @Allow(Permission.Public)
    async marketplaceProducts(@Ctx() ctx: RequestContext) {
        const products = await this.marketplaceService.getMarketplaceProducts(ctx);
        return products.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            barcode: product.customFields.barcode ?? null,
            internalCode: product.customFields.internalCode ?? null,
            merchantChannel: product.customFields.merchantRef
                ? {
                      id: (product.customFields.merchantRef as any).id,
                      code: (product.customFields.merchantRef as any).code,
                      name: (product.customFields.merchantRef as any).name,
                  }
                : null,
        }));
    }
}