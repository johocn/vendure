import { RequestContext } from '../../api/common/request-context';
import { ConfigService, SlugGenerateParams } from '../../config';
/**
 * @description
 * A service that handles slug generation using the configured SlugStrategy.
 *
 * @docsCategory services
 * @since 3.5.0
 */
export declare class SlugService {
    private configService;
    constructor(configService: ConfigService);
    /**
     * @description
     * Generates a slug from the input string using the configured SlugStrategy.
     *
     * @param ctx The request context
     * @param params The parameters for slug generation
     * @returns A URL-friendly slug string
     */
    generate(ctx: RequestContext, params: SlugGenerateParams): Promise<string>;
}
