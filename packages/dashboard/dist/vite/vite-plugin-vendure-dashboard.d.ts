import { PluginOption } from 'vite';
import { PathAdapter } from './types.js';
import { PackageScannerConfig } from './utils/compiler.js';
import { ThemeVariablesPluginOptions } from './vite-plugin-theme.js';
import { UiConfigPluginOptions } from './vite-plugin-ui-config.js';
/**
 * @description
 * Options for the {@link vendureDashboardPlugin} Vite plugin.
 *
 * @docsCategory vite-plugin
 * @docsPage vendureDashboardPlugin
 * @since 3.4.0
 * @docsWeight 1
 */
export type VitePluginVendureDashboardOptions = {
    /**
     * @description
     * The path to the Vendure server configuration file.
     */
    vendureConfigPath: string | URL;
    /**
     * @description
     * The {@link PathAdapter} allows you to customize the resolution of paths
     * in the compiled Vendure source code which is used as part of the
     * introspection step of building the dashboard.
     *
     * It enables support for more complex repository structures, such as
     * monorepos, where the Vendure server configuration file may not
     * be located in the root directory of the project.
     *
     * If you get compilation errors like "Error loading Vendure config: Cannot find module",
     * you probably need to provide a custom `pathAdapter` to resolve the paths correctly.
     *
     * @example
     * ```ts
     * vendureDashboardPlugin({
     *     tempCompilationDir: join(__dirname, './__vendure-dashboard-temp'),
     *     pathAdapter: {
     *         getCompiledConfigPath: ({ inputRootDir, outputPath, configFileName }) => {
     *             const projectName = inputRootDir.split('/libs/')[1].split('/')[0];
     *             const pathAfterProject = inputRootDir.split(`/libs/${projectName}`)[1];
     *             const compiledConfigFilePath = `${outputPath}/${projectName}${pathAfterProject}`;
     *             return path.join(compiledConfigFilePath, configFileName);
     *         },
     *         transformTsConfigPathMappings: ({ phase, patterns }) => {
     *             // "loading" phase is when the compiled Vendure code is being loaded by
     *             // the plugin, in order to introspect the configuration of your app.
     *             if (phase === 'loading') {
     *                 return patterns.map((p) =>
     *                     p.replace('libs/', '').replace(/.ts$/, '.js'),
     *                 );
     *             }
     *             return patterns;
     *         },
     *     },
     *     // ...
     * }),
     * ```
     */
    pathAdapter?: PathAdapter;
    /**
     * @description
     * The name of the exported variable from the Vendure server configuration file, e.g. `config`.
     * This is only required if the plugin is unable to auto-detect the name of the exported variable.
     */
    vendureConfigExport?: string;
    /**
     * @description
     * The path to the directory where the generated GraphQL Tada files will be output.
     */
    gqlOutputPath?: string;
    tempCompilationDir?: string;
    /**
     * @description
     * Allows you to customize the location of node_modules & glob patterns used to scan for potential
     * Vendure plugins installed as npm packages. If not provided, the compiler will attempt to guess
     * the location based on the location of the `@vendure/core` package.
     */
    pluginPackageScanner?: PackageScannerConfig;
    /**
     * @description
     * Allows you to specify the module system to use when compiling and loading your Vendure config.
     * By default, the compiler will use CommonJS, but you can set it to `esm` if you are using
     * ES Modules in your Vendure project.
     *
     * **Status** Developer preview. If you are using ESM please try this out and provide us with feedback!
     *
     * @since 3.5.1
     * @default 'commonjs'
     */
    module?: 'commonjs' | 'esm';
    /**
     * @description
     * Allows you to selectively disable individual plugins.
     * @example
     * ```ts
     * vendureDashboardPlugin({
     *   vendureConfigPath: './config.ts',
     *   disablePlugins: {
     *     react: true,
     *     lingui: true,
     *   }
     * })
     * ```
     */
    disablePlugins?: {
        tanstackRouter?: boolean;
        linguiBabel?: boolean;
        react?: boolean;
        lingui?: boolean;
        themeVariables?: boolean;
        tailwindSource?: boolean;
        tailwindcss?: boolean;
        configLoader?: boolean;
        viteConfig?: boolean;
        adminApiSchema?: boolean;
        dashboardMetadata?: boolean;
        uiConfig?: boolean;
        gqlTada?: boolean;
        transformIndexHtml?: boolean;
        translations?: boolean;
        hmr?: boolean;
    };
} & UiConfigPluginOptions & ThemeVariablesPluginOptions;
/**
 * @description
 * This is the Vite plugin which powers the Vendure Dashboard, including:
 *
 * - Configuring routing, styling and React support
 * - Analyzing your VendureConfig file and introspecting your schema
 * - Loading your custom Dashboard extensions
 *
 * @docsCategory vite-plugin
 * @docsPage vendureDashboardPlugin
 * @since 3.4.0
 * @docsWeight 0
 */
export declare function vendureDashboardPlugin(options: VitePluginVendureDashboardOptions): PluginOption[];
/**
 * Get the normalized path to the Vendure config file given either a string or URL.
 */
export declare function getNormalizedVendureConfigPath(vendureConfigPath: string | URL): string;
export declare function fixWindowsPath(filePath: string): string;
