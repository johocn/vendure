import { RequestContext } from '../../api/common/request-context';
import { SlugGenerateParams, SlugStrategy } from './slug-strategy';
/**
 * @description
 * The default strategy for generating slugs. This strategy:
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes non-alphanumeric characters (except hyphens)
 * - Removes leading and trailing hyphens
 * - Collapses multiple hyphens into one
 *
 * @example
 * ```ts
 * const strategy = new DefaultSlugStrategy();
 * strategy.generate(ctx, { value: "Hello World!" }); // "hello-world"
 * strategy.generate(ctx, { value: "Café Français" }); // "cafe-francais"
 * strategy.generate(ctx, { value: "100% Natural" }); // "100-natural"
 * ```
 *
 * @docsCategory configuration
 * @since 3.5.0
 */
export declare class DefaultSlugStrategy implements SlugStrategy {
    generate(ctx: RequestContext, params: SlugGenerateParams): string;
}
