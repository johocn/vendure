// e:\code\vendure\packages\operations-plugin\src\operations-shop.resolver.ts
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { ContentService } from './content.service';

/**
 * @description
 * Operations Shop API Resolver (schema-first mode).
 * Only exposes public content queries; dashboard is admin-only.
 *
 * Note: @Allow(Permission.Public) is REQUIRED for public access.
 * Vendure's default behavior when @Allow is not set is to deny access.
 */
@Resolver()
export class OperationsShopResolver {
    constructor(private contentService: ContentService) {}

    @Query()
    @Allow(Permission.Public)
    async publishedContent(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'type', type: () => String, nullable: true }) type?: string,
        @Args({ name: 'position', type: () => String, nullable: true }) position?: string,
    ) {
        return this.contentService.findPublishedContentItems(ctx, { type, position });
    }
}
