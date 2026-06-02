import { Injectable } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';

@Injectable()
export class TenantSetupService {
    constructor(private channelService: ChannelService) {}

    async getChannelPromotionPolicy(ctx: RequestContext): Promise<{
        couponStackable: boolean;
        maxStackableCount: number | null;
    }> {
        const channel = ctx.channel;
        const ccf = (channel as any).customFields;
        return {
            couponStackable: ccf?.couponStackable ?? false,
            maxStackableCount: ccf?.maxStackableCount ?? null,
        };
    }

    async updateChannelPromotionPolicy(
        ctx: RequestContext,
        couponStackable: boolean,
        maxStackableCount?: number,
    ): Promise<void> {
        const channel = ctx.channel;
        const ccf = (channel as any).customFields;
        if (ccf) {
            ccf.couponStackable = couponStackable;
            if (maxStackableCount != null) {
                ccf.maxStackableCount = maxStackableCount;
            }
        }
        Logger.info(
            `Updated channel ${channel.code} promotion policy: stackable=${couponStackable}, max=${maxStackableCount}`,
            loggerCtx,
        );
    }
}
