import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { OrderListOptions } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, Order, Permission, RequestContext, Transaction, TransactionalConnection } from '@vendure/core';

import { MarketplaceService } from '../marketplace.service';

@Resolver()
export class AdminMarketplaceResolver {
    constructor(
        private marketplaceService: MarketplaceService,
        private connection: TransactionalConnection,
    ) {}

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

    @Query('marketplaceMerchantChannel')
    @Allow(Permission.ReadOrder)
    marketplaceMerchantChannel(@Ctx() ctx: RequestContext) {
        return ctx.channel;
    }

    @Query('merchantOrders')
    @Allow(Permission.ReadOrder)
    async merchantOrders(
        @Ctx() ctx: RequestContext,
        @Args() args: { saleSource?: string; options?: OrderListOptions },
    ) {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.channels', 'channel')
            .where('channel.id = :channelId', { channelId: ctx.channelId });
        const orders = await qb.getMany();
        const filtered = args.saleSource
            ? orders.filter(o => o.customFields?.saleSource === args.saleSource)
            : orders;
        const skip = args.options?.skip ?? 0;
        const take = args.options?.take ?? filtered.length;
        return {
            items: filtered.slice(skip, skip + take),
            totalItems: filtered.length,
        };
    }
}