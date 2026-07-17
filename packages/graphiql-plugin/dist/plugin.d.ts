import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Type } from '@vendure/common/lib/shared-types';
import { ConfigService, ProcessContext } from '@vendure/core';
import { GraphiQLService } from './graphiql.service';
import { GraphiqlPluginOptions } from './types';
/**
 * @description
 * This plugin provides a GraphiQL UI for exploring and testing the Vendure GraphQL APIs.
 *
 * It adds routes `/graphiql/admin` and `/graphiql/shop` which serve the GraphiQL interface
 * for the respective APIs.
 *
 * ## Installation
 *
 * ```ts
 * import { GraphiqlPlugin } from '\@vendure/graphiql-plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     GraphiqlPlugin.init({
 *       route: 'graphiql', // Optional, defaults to 'graphiql'
 *     }),
 *   ],
 * };
 * ```
 *
 * ## Custom API paths
 *
 * By default, the plugin automatically reads the Admin API and Shop API paths from your Vendure configuration.
 *
 * If you need to override these paths, you can specify them explicitly:
 *
 * ```typescript
 * GraphiQLPlugin.init({
 *     route: 'my-custom-route', // defaults to `graphiql`
 * });
 * ```
 *
 * ## Query parameters
 *
 * You can add the following query parameters to the GraphiQL URL:
 *
 * - `?query=...` - Pre-populate the query editor with a GraphQL query.
 * - `?embeddedMode=true` - This renders the editor in embedded mode, which hides the header and
 *    the API switcher. This is useful for embedding GraphiQL in other applications such as documentation.
 *    In this mode, the editor also does not persist changes across reloads.
 *
 * @docsCategory core plugins/GraphiqlPlugin
 */
export declare class GraphiqlPlugin implements NestModule {
    private readonly processContext;
    private readonly configService;
    private readonly graphiQLService;
    static options: Required<GraphiqlPluginOptions>;
    constructor(processContext: ProcessContext, configService: ConfigService, graphiQLService: GraphiQLService);
    /**
     * Initialize the plugin with the given options.
     */
    static init(options?: GraphiqlPluginOptions): Type<GraphiqlPlugin>;
    configure(consumer: MiddlewareConsumer): void;
    private createStaticServer;
    private createAssetsServer;
}
