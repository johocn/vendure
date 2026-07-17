import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { LogisticsService } from './logistics.service';
import { CARRIERS } from './carrier-dictionary';

@Resolver()
export class LogisticsAdminResolver {
    constructor(private logisticsService: LogisticsService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async logisticsTracks(@Ctx() ctx: RequestContext, @Args('orderId') orderId: number): Promise<any> {
        const tracks = await this.logisticsService.getTracksByOrder(ctx, orderId as any);
        return tracks.map(t => this.toGraphQl(t));
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async logisticsTrack(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        const track = await this.logisticsService.findOne(ctx, id as any);
        return track ? this.toGraphQl(track) : null;
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async carriers(): Promise<any[]> {
        return CARRIERS;
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async batchCreateFulfillment(@Ctx() ctx: RequestContext, @Args('items') items: any[]): Promise<any> {
        const results = await this.logisticsService.batchCreateFulfillment(
            ctx,
            items.map((i: any) => ({
                orderId: i.orderId,
                trackingNo: i.trackingNo,
                carrierCode: i.carrierCode,
            })),
        );
        return {
            items: results.map(r => ({
                orderId: r.orderId,
                success: r.success,
                trackId: r.trackId,
                error: r.error ?? null,
            })),
        };
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async refreshTrack(@Ctx() ctx: RequestContext, @Args('id') id: number): Promise<any> {
        const track = await this.logisticsService.queryTrack(ctx, id as any);
        return this.toGraphQl(track);
    }

    private toGraphQl(track: any): any {
        return {
            id: track.id,
            fulfillmentId: track.fulfillmentId,
            trackingNo: track.trackingNo,
            carrierCode: track.carrierCode,
            carrierName: track.carrierCode,
            status: track.status,
            trackInfo: track.trackInfo,
            signedAt: track.signedAt,
            lastSyncedAt: track.lastSyncedAt,
        };
    }
}
