import { ChannelService, RequestContext } from '@vendure/core';
export interface DomainResolveResult {
    token: string;
    code: string;
}
export declare class DomainResolverService {
    private channelService;
    constructor(channelService: ChannelService);
    resolveByDomain(ctx: RequestContext, host: string): Promise<DomainResolveResult | null>;
}
