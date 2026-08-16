import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    InternalServerError,
    Permission,
    RequestContext,
    Transaction,
    TransactionalConnection,
} from '@vendure/core';
import { Product } from '@vendure/core';

import { MarketplaceSellerService } from '../marketplace-seller-service';
import { MarketplaceService } from '../marketplace.service';
import { CreateSellerInput } from '../types';

@Resolver()
export class ShopResolver {
    constructor(
        private marketplaceSellerService: MarketplaceSellerService,
        private marketplaceService: MarketplaceService,
        private connection: TransactionalConnection,
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

    @Mutation('submitForMarketplace')
    @Transaction()
    @Allow(Permission.UpdateCatalog, Permission.UpdateProduct)
    async submitForMarketplace(
        @Ctx() ctx: RequestContext,
        @Args() args: { productId: string },
    ): Promise<boolean> {
        await this.marketplaceService.submitForMarketplace(ctx, args.productId);
        return true;
    }

    @Query('myMerchantProducts')
    @Allow(Permission.ReadCatalog, Permission.ReadProduct)
    async myMerchantProducts(@Ctx() ctx: RequestContext) {
        const products = await this.connection.getRepository(ctx, Product).find({
            where: { channels: { id: ctx.channelId } } as any,
        });
        return products.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            barcode: product.customFields.barcode ?? null,
            internalCode: product.customFields.internalCode ?? null,
            marketplaceStatus: product.customFields.marketplaceStatus ?? 'pending',
            rejectReason: product.customFields.rejectReason ?? null,
            listedInMarketplace: product.customFields.listedInMarketplace ?? false,
        }));
    }

    @Query('marketplacePendingProducts')
    @Allow(Permission.SuperAdmin, Permission.UpdateProduct)
    async marketplacePendingProducts(@Ctx() ctx: RequestContext) {
        const products = await this.marketplaceService.getPendingProducts(ctx);
        return products.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            barcode: product.customFields.barcode ?? null,
            internalCode: product.customFields.internalCode ?? null,
            marketplaceStatus: product.customFields.marketplaceStatus ?? 'pending',
            rejectReason: product.customFields.rejectReason ?? null,
            listedInMarketplace: product.customFields.listedInMarketplace ?? false,
        }));
    }

    @Mutation('marketplaceApprove')
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateProduct)
    async marketplaceApprove(
        @Ctx() ctx: RequestContext,
        @Args() args: { productId: string },
    ): Promise<boolean> {
        await this.marketplaceService.approveMarketplaceProduct(ctx, args.productId);
        return true;
    }

    @Mutation('marketplaceReject')
    @Transaction()
    @Allow(Permission.SuperAdmin, Permission.UpdateProduct)
    async marketplaceReject(
        @Ctx() ctx: RequestContext,
        @Args() args: { productId: string; reason: string },
    ): Promise<boolean> {
        await this.marketplaceService.rejectMarketplaceProduct(ctx, args.productId, args.reason);
        return true;
    }
}