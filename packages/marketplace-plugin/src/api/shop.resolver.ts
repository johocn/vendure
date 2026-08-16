import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, InternalServerError, Permission, RequestContext, Transaction } from '@vendure/core';

import { MarketplaceSellerService } from '../marketplace-seller-service';
import { CreateSellerInput } from '../types';

@Resolver()
export class ShopResolver {
    constructor(private marketplaceSellerService: MarketplaceSellerService) {}

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
}