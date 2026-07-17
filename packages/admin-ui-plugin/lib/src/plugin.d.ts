import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AdminUiAppConfig, AdminUiAppDevModeConfig, AdminUiConfig, Type } from '@vendure/common/lib/shared-types';
import { ConfigService, ProcessContext } from '@vendure/core';
/**
 * @description
 * Configuration options for the {@link AdminUiPlugin}.
 *
 * @docsCategory core plugins/AdminUiPlugin
 */
export interface AdminUiPluginOptions {
    /**
     * @description
     * The route to the Admin UI.
     *
     * Note: If you are using the `compileUiExtensions` function to compile a custom version of the Admin UI, then
     * the route should match the `baseHref` option passed to that function. The default value of `baseHref` is `/admin/`,
     * so it only needs to be changed if you set this `route` option to something other than `"admin"`.
     */
    route: string;
    /**
     * @description
     * The port on which the server will listen. This port will be proxied by the AdminUiPlugin to the same port that
     * the Vendure server is running on.
     */
    port: number;
    /**
     * @description
     * The hostname of the server serving the static admin ui files.
     *
     * @default 'localhost'
     */
    hostname?: string;
    /**
     * @description
     * By default, the AdminUiPlugin comes bundles with a pre-built version of the
     * Admin UI. This option can be used to override this default build with a different
     * version, e.g. one pre-compiled with one or more ui extensions.
     */
    app?: AdminUiAppConfig | AdminUiAppDevModeConfig;
    /**
     * @description
     * Allows the contents of the `vendure-ui-config.json` file to be set, e.g.
     * for specifying the Vendure GraphQL API host, available UI languages, etc.
     */
    adminUiConfig?: Partial<AdminUiConfig>;
    /**
     * @description
     * @deprecated This option no longer has any effect.
     *
     * Previously used when running the AdminUiPlugin at the same time as the new `DashboardPlugin`
     * to avoid conflicts, but this is no longer necessary as the schemas use different type names.
     *
     * @since 3.4.0
     */
    compatibilityMode?: boolean;
}
/**
 * @description
 *
 * :::warning[Deprecated]
 * From Vendure v3.5.0, the Angular-based Admin UI has been replaced by the new [React Admin Dashboard](/extending-the-dashboard/getting-started/).
 * The Angular Admin UI will not be maintained after **July 2026**. Until then, we will continue patching critical bugs and security issues.
 * Community contributions will always be merged and released.
 * :::
 *
 * This plugin starts a static server for the Admin UI app, and proxies it via the `/admin/` path of the main Vendure server.
 *
 * The Admin UI allows you to administer all aspects of your store, from inventory management to order tracking. It is the tool used by
 * store administrators on a day-to-day basis for the management of the store.
 *
 * ## Installation
 *
 * `yarn add \@vendure/admin-ui-plugin`
 *
 * or
 *
 * `npm install \@vendure/admin-ui-plugin`
 *
 * @example
 * ```ts
 * import { AdminUiPlugin } from '\@vendure/admin-ui-plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     AdminUiPlugin.init({ port: 3002 }),
 *   ],
 * };
 * ```
 *
 * ## Metrics
 *
 * This plugin also defines a `metricSummary` query which is used by the Admin UI to display the order metrics on the dashboard.
 *
 * If you are building a stand-alone version of the Admin UI app, and therefore don't need this plugin to server the Admin UI,
 * you can still use the `metricSummary` query by adding the `AdminUiPlugin` to the `plugins` array, but without calling the `init()` method:
 *
 * @example
 * ```ts
 * import { AdminUiPlugin } from '\@vendure/admin-ui-plugin';
 *
 * const config: VendureConfig = {
 *   plugins: [
 *     AdminUiPlugin, // <-- no call to .init()
 *   ],
 *   // ...
 * };
 * ```
 *
 * @docsCategory core plugins/AdminUiPlugin
 */
export declare class AdminUiPlugin implements NestModule {
    private configService;
    private processContext;
    private static options;
    constructor(configService: ConfigService, processContext: ProcessContext);
    /**
     * @description
     * Set the plugin options
     */
    static init(options: AdminUiPluginOptions): Type<AdminUiPlugin>;
    configure(consumer: MiddlewareConsumer): Promise<void>;
    private createStaticServer;
    /**
     * Takes an optional AdminUiConfig provided in the plugin options, and returns a complete
     * config object for writing to disk.
     */
    private getAdminUiConfig;
    /**
     * Overwrites the parts of the admin-ui app's `vendure-ui-config.json` file relating to connecting to
     * the server admin API.
     */
    private overwriteAdminUiConfig;
    /**
     * Overwrites the parts of the admin-ui app's `vendure-ui-config.json` file relating to connecting to
     * the server admin API.
     */
    private overwriteBaseHref;
    /**
     * It might be that the ui-devkit compiler has not yet copied the config
     * file to the expected location (particularly when running in watch mode),
     * so polling is used to check multiple times with a delay.
     */
    private pollForFile;
    private static isDevModeApp;
}
