import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { Query, Resolver, Args } from '@nestjs/graphql';
import { DomainResolverService, DomainResolveResult } from './domain-resolver.service';

@Resolver()
export class DomainShopResolver {
    constructor(private domainResolverService: DomainResolverService) {}

    @Query()
    @Allow(Permission.Public)
    async resolveChannelByDomain(
        @Ctx() ctx: RequestContext,
        @Args('host') host: string,
    ): Promise<DomainResolveResult | null> {
        return this.domainResolverService.resolveByDomain(ctx, host);
    }
}
