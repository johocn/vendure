import { lingui } from '@lingui/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { adminApiSchemaPlugin } from './vite-plugin-admin-api-schema.js';
import { configLoaderPlugin } from './vite-plugin-config-loader.js';
import { viteConfigPlugin } from './vite-plugin-config.js';
import { dashboardMetadataPlugin } from './vite-plugin-dashboard-metadata.js';
import { gqlTadaPlugin } from './vite-plugin-gql-tada.js';
import { hmrPlugin } from './vite-plugin-hmr.js';
import { linguiBabelPlugin } from './vite-plugin-lingui-babel.js';
import { dashboardTailwindSourcePlugin } from './vite-plugin-tailwind-source.js';
import { themeVariablesPlugin } from './vite-plugin-theme.js';
import { transformIndexHtmlPlugin } from './vite-plugin-transform-index.js';
import { translationsPlugin } from './vite-plugin-translations.js';
import { uiConfigPlugin } from './vite-plugin-ui-config.js';
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
export function vendureDashboardPlugin(options) {
    var _a, _b;
    const tempDir = (_a = options.tempCompilationDir) !== null && _a !== void 0 ? _a : path.join(import.meta.dirname, './.vendure-dashboard-temp');
    const normalizedVendureConfigPath = getNormalizedVendureConfigPath(options.vendureConfigPath);
    const packageRoot = getDashboardPackageRoot();
    const linguiConfigPath = path.join(packageRoot, 'lingui.config.js');
    const disabled = (_b = options.disablePlugins) !== null && _b !== void 0 ? _b : {};
    if (process.env.IS_LOCAL_DEV !== 'true') {
        process.env.LINGUI_CONFIG = linguiConfigPath;
    }
    const pluginMap = [
        {
            key: 'tanstackRouter',
            plugin: () => tanstackRouter({
                autoCodeSplitting: true,
                routeFileIgnorePattern: '.graphql.ts|components|hooks|utils',
                routesDirectory: path.join(packageRoot, 'src/app/routes'),
                generatedRouteTree: path.join(packageRoot, 'src/app/routeTree.gen.ts'),
            }),
        },
        {
            // Custom plugin that transforms Lingui macros using Babel instead of SWC.
            // This runs BEFORE the react plugin to ensure macros are transformed first.
            // Using Babel eliminates the SWC binary compatibility issues that caused
            // "failed to invoke plugin" errors in external projects.
            // See: https://github.com/vendurehq/vendure/issues/3929
            key: 'linguiBabel',
            plugin: () => linguiBabelPlugin(),
        },
        {
            key: 'react',
            plugin: () => react(),
        },
        {
            key: 'lingui',
            plugin: () => {
                const linguiPlugins = lingui({});
                // Filter out the macro error reporter added in @lingui/vite-plugin 5.9+.
                // It throws on resolveId before our custom linguiBabelPlugin can transform
                // the macros away in its transform hook.
                return (Array.isArray(linguiPlugins) ? linguiPlugins : [linguiPlugins]).filter((p) => (p === null || p === void 0 ? void 0 : p.name) !== 'vite-plugin-lingui-report-macro-error');
            },
        },
        {
            key: 'themeVariables',
            plugin: () => themeVariablesPlugin({ theme: options.theme }),
        },
        {
            key: 'tailwindSource',
            plugin: () => dashboardTailwindSourcePlugin(),
        },
        {
            key: 'tailwindcss',
            plugin: () => tailwindcss(),
        },
        {
            key: 'configLoader',
            plugin: () => configLoaderPlugin({
                vendureConfigPath: normalizedVendureConfigPath,
                outputPath: tempDir,
                pathAdapter: options.pathAdapter,
                pluginPackageScanner: options.pluginPackageScanner,
                module: options.module,
            }),
        },
        {
            key: 'viteConfig',
            plugin: () => viteConfigPlugin({ packageRoot }),
        },
        {
            key: 'adminApiSchema',
            plugin: () => adminApiSchemaPlugin(),
        },
        {
            key: 'dashboardMetadata',
            plugin: () => dashboardMetadataPlugin(),
        },
        {
            key: 'uiConfig',
            plugin: () => uiConfigPlugin(options),
        },
        {
            key: 'gqlTada',
            plugin: () => options.gqlOutputPath &&
                gqlTadaPlugin({ gqlTadaOutputPath: options.gqlOutputPath, tempDir, packageRoot }),
        },
        {
            key: 'transformIndexHtml',
            plugin: () => transformIndexHtmlPlugin(),
        },
        {
            key: 'translations',
            plugin: () => translationsPlugin({
                packageRoot,
            }),
        },
        {
            key: 'hmr',
            plugin: () => hmrPlugin(),
        },
    ];
    const plugins = [];
    for (const entry of pluginMap) {
        if (!disabled[entry.key]) {
            const plugin = entry.plugin();
            if (plugin) {
                if (Array.isArray(plugin)) {
                    plugins.push(...plugin);
                }
                else {
                    plugins.push(plugin);
                }
            }
        }
    }
    return plugins;
}
/**
 * @description
 * Returns the path to the root of the `@vendure/dashboard` package.
 */
function getDashboardPackageRoot() {
    const fileUrl = import.meta.resolve('@vendure/dashboard');
    const packagePath = fileUrl.startsWith('file:') ? new URL(fileUrl).pathname : fileUrl;
    return fixWindowsPath(path.join(packagePath, '../../../'));
}
/**
 * Get the normalized path to the Vendure config file given either a string or URL.
 */
export function getNormalizedVendureConfigPath(vendureConfigPath) {
    const stringPath = typeof vendureConfigPath === 'string' ? vendureConfigPath : vendureConfigPath.href;
    if (stringPath.startsWith('file:')) {
        return fixWindowsPath(new URL(stringPath).pathname);
    }
    return fixWindowsPath(stringPath);
}
export function fixWindowsPath(filePath) {
    // Fix Windows paths that might start with a leading slash
    if (process.platform === 'win32') {
        // Remove leading slash before drive letter on Windows
        if (/^[/\\][A-Za-z]:/.test(filePath)) {
            return filePath.substring(1);
        }
    }
    return filePath;
}
