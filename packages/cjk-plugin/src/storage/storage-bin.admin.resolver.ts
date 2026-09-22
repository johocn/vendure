import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { StorageBinService } from './storage-bin.service';

/** 库位/库区管理（三档开关共用同一套接口，差异只在前端门控） */
@Resolver()
export class StorageBinAdminResolver {
    constructor(private storageBinService: StorageBinService) {}

    @Query()
    @Allow(Permission.ReadCatalog)
    async storageZones(@Ctx() ctx: RequestContext, @Args('stockLocationId') stockLocationId: ID) {
        return this.storageBinService.zones(ctx, Number(stockLocationId));
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async storageBins(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.storageBinService.bins(
            ctx,
            Number(args.stockLocationId),
            args.zoneId ? Number(args.zoneId) : null,
        );
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async variantBin(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.storageBinService.variantBin(
            ctx,
            Number(args.variantId),
            Number(args.stockLocationId),
        );
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog)
    async generateStandardBins(
        @Ctx() ctx: RequestContext,
        @Args('stockLocationId') stockLocationId: ID,
    ) {
        return this.storageBinService.generateStandard(ctx, Number(stockLocationId));
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog)
    async bindVariantToBin(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.storageBinService.bind(ctx, {
            variantId: Number(input.variantId),
            stockLocationId: Number(input.stockLocationId),
            zoneId: Number(input.zoneId),
            binId: input.binId ? Number(input.binId) : null,
        });
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog)
    async unbindVariantFromBin(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.storageBinService.unbind(
            ctx,
            Number(args.variantId),
            Number(args.stockLocationId),
        );
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog)
    async deleteStorageBin(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.storageBinService.deleteBin(ctx, id);
    }
}