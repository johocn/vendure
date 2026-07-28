import { RequestContext } from '@vendure/core';
import { ContentService } from './content.service';
/**
 * @description
 * Operations Shop API Resolver (schema-first mode).
 * Only exposes public content queries; dashboard is admin-only.
 *
 * Note: @Allow(Permission.Public) is REQUIRED for public access.
 * Vendure's default behavior when @Allow is not set is to deny access.
 */
export declare class OperationsShopResolver {
    private contentService;
    constructor(contentService: ContentService);
    publishedContent(ctx: RequestContext, type?: string, position?: string): Promise<import(".").ContentItem[]>;
}
