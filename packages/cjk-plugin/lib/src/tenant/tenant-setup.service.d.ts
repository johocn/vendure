import { ChannelService, RequestContext } from '@vendure/core';
export declare class TenantSetupService {
    private channelService;
    constructor(channelService: ChannelService);
    getChannelPromotionPolicy(ctx: RequestContext): Promise<{
        couponStackable: boolean;
        maxStackableCount: number | null;
    }>;
    updateChannelPromotionPolicy(ctx: RequestContext, couponStackable: boolean, maxStackableCount?: number): Promise<void>;
}
