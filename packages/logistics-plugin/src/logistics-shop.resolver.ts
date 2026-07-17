import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { LogisticsService } from './logistics.service';

@Resolver()
export class LogisticsShopResolver {
    constructor(private logisticsService: LogisticsService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myOrderTracks(@Ctx() ctx: RequestContext, @Args('orderId') orderId: number): Promise<any[]> {
        const tracks = await this.logisticsService.getMyOrderTracks(ctx, orderId as any);
        return tracks.map(t => ({
            id: t.id,
            fulfillmentId: t.fulfillmentId,
            trackingNo: t.trackingNo,
            carrierCode: t.carrierCode,
            carrierName: t.carrierCode,
            status: t.status,
            trackInfo: t.trackInfo,
            signedAt: t.signedAt,
            lastSyncedAt: t.lastSyncedAt,
        }));
    }
}
