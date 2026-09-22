import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { StorageBinService } from './storage-bin.service';

/** C 端只读：展示某 SKU 的库区/库位（三档差异由前端门控） */
@Resolver()
export class StorageBinShopResolver {
    constructor(private storageBinService: StorageBinService) {}

    @Query()
    @Allow(Permission.Public)
    async variantBin(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.storageBinService.variantBin(
            ctx,
            Number(args.variantId),
            Number(args.stockLocationId),
        );
    }

    @Query()
    @Allow(Permission.Public)
    async storageZones(@Ctx() ctx: RequestContext, @Args('stockLocationId') stockLocationId: ID) {
        return this.storageBinService.zones(ctx, Number(stockLocationId));
    }
}