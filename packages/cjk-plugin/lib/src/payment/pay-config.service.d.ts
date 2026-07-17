import { RequestContext, ChannelService } from '@vendure/core';
import type { PayConfig } from './payment-config.types';
export declare class PayConfigService {
    private channelService;
    constructor(channelService: ChannelService);
    private parseStruct;
    private serializeDomain;
    getMasked(ctx: RequestContext, channelId: string): Promise<PayConfig | null>;
    update(ctx: RequestContext, channelId: string, patch: Partial<PayConfig> | null): Promise<PayConfig | null>;
}
