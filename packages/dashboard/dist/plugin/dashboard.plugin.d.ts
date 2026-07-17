import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Type } from '@vendure/common/lib/shared-types';
import { ProcessContext } from '@vendure/core';
/**
 * @description
 * Configuration options for the {@link DashboardPlugin}.
 *
 * @docsCategory core plugins/DashboardPlugin
 */
export interface DashboardPluginOptions {
    /**
     * @description
     * The route to the Dashboard UI.
     *
     * @default 'dashboard'
     */
    route: string;
    /**
     * @description
     * The path to the dashboard UI app dist directory.
     */
    appDir: string;
    /**
     * @description
     * The port on which to check for a running Vite dev server.
     * If a Vite dev server is detected on this port, requests will be proxied to it
     * instead of serving static files from appDir.
     *
     * @default 5173
     */
    viteDevServerPort?: number;
}
/**
 * @description
 * This plugin serves the static files of the Vendure Dashboard and provides the
 * GraphQL extensions needed for the order metrics on the dashboard index page.
 *
 * ## Installation
 *
 * `npm install \@vendure/dashboard`
 *
 * ## Usage
 *
 * First you need to set up compilation of the Dashboard, using the Vite configuration
 * described in the [Dashboard Getting Started Guide](/extending-the-dashboard/getting-started/)
 *
 * ## Development vs Production
 *
 * When developing, you can run `npx vite` (or `npm run dev`) to start the Vite development server.
 * The plugin will automatically detect if Vite is running on the default port (5173) and proxy
 * requests to it instead of serving static files. This enables hot module replacement and faster
 * development iterations.
 *
 * For production, run `npx vite build` to build the dashboard app. The built app files will be
 * output to the location specified by `build.outDir` in your Vite config file. This should then
 * be passed to the `appDir` init option, as in the example below:
 *
 * @example
 * ```ts
 * import { DashboardPlugin } from '\@vendure/dashboard/plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     DashboardPlugin.init({
 *       route: 'dashboard',
 *       appDir: './dist/dashboard',
 *       // Optional: customize Vite dev server port (defaults to 5173)
 *       viteDevServerPort: 3000,
 *     }),
 *   ],
 * };
 * ```
 *
 * ## Metrics
 *
 * This plugin defines a `metricSummary` query which is used by the Dashboard UI to
 * display the order metrics on the dashboard.
 *
 * If you are building a stand-alone version of the Dashboard UI app, and therefore
 * don't need this plugin to serve the Dashboard UI, you can still use the
 * `metricSummary` query by adding the `DashboardPlugin` to the `plugins` array,
 * but without calling the `init()` method:
 *
 * @example
 * ```ts
 * import { DashboardPlugin } from '\@vendure/dashboard-plugin';
 *
 * const config: VendureConfig = {
 *   plugins: [
 *     DashboardPlugin, // <-- no call to .init()
 *   ],
 *   // ...
 * };
 * ```
 *
 * @docsCategory core plugins/DashboardPlugin
 */
export declare class DashboardPlugin implements NestModule {
    private readonly processContext;
    private static options;
    private readonly rateLimitRequests;
    constructor(processContext: ProcessContext);
    /**
     * @description
     * Set the plugin options
     */
    static init(options: DashboardPluginOptions): Type<DashboardPlugin>;
    configure(consumer: MiddlewareConsumer): void;
    private createStaticServer;
    private checkViteDevServer;
    private checkBuiltFiles;
    private createDefaultPage;
    private createDynamicHandler;
}
