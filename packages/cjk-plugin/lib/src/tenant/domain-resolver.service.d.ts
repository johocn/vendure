import { ChannelService, RequestContext } from '@vendure/core';
export interface DomainResolveResult {
    token: string;
    code: string;
}
export interface ChannelResolveResult {
    token: string;
    code: string;
    customFields: {
        shopName: string | null;
        shopLogo: string | null;
        shopIntro: string | null;
        servicePhone: string | null;
        shopContent: string | null;
        displayTemplate: string | null;
        themeId: string | null;
    };
}
export declare class DomainResolverService {
    private channelService;
    constructor(channelService: ChannelService);
    resolveByDomain(ctx: RequestContext, host: string): Promise<DomainResolveResult | null>;
    resolveByCode(ctx: RequestContext, code: string): Promise<ChannelResolveResult | null>;
}
