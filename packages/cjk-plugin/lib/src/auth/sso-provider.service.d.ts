import { RequestContext, ChannelService } from '@vendure/core';
import type { SsoProvider } from './auth-config.types';
export interface TestSsoResult {
    success: boolean;
    latencyMs: number;
    error?: string;
}
export declare class SsoProviderService {
    private channelService;
    constructor(channelService: ChannelService);
    getProviders(ctx: RequestContext, channelId: string): Promise<SsoProvider[]>;
    testConnection(ctx: RequestContext, channelId: string, providerKey: string, newClientSecret?: string): Promise<TestSsoResult>;
}
