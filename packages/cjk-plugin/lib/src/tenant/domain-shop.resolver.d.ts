import { RequestContext } from '@vendure/core';
import { DomainResolverService, DomainResolveResult, ChannelResolveResult } from './domain-resolver.service';
export declare class DomainShopResolver {
    private domainResolverService;
    constructor(domainResolverService: DomainResolverService);
    resolveChannelByDomain(ctx: RequestContext, host: string): Promise<DomainResolveResult | null>;
    resolveChannelByCode(ctx: RequestContext, code: string): Promise<ChannelResolveResult | null>;
}
