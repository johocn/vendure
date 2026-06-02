import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { LogisticsQueryService } from './logistics-query.service';

@Resolver()
export class LogisticsApiAdminResolver {
    constructor(private logisticsQueryService: LogisticsQueryService) {}

    @Query()
    async logisticsTracking(
        @Ctx() ctx: RequestContext,
        @Args('carrierCode') carrierCode: string,
        @Args('trackingNumber') trackingNumber: string,
    ) {
        const result = await this.logisticsQueryService.queryTracking(ctx, carrierCode, trackingNumber);
        return result;
    }

    @Query()
    async detectCarrier(
        @Ctx() ctx: RequestContext,
        @Args('trackingNumber') trackingNumber: string,
    ) {
        return this.logisticsQueryService.detectCarrier(ctx, trackingNumber);
    }
}
