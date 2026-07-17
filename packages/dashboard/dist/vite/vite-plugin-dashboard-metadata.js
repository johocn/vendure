import path from 'path';
import { pathToFileURL } from 'node:url';
import { getConfigLoaderApi } from './vite-plugin-config-loader.js';
const virtualModuleId = 'virtual:dashboard-extensions';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
/**
 * This Vite plugin scans the configured plugins for any dashboard extensions and dynamically
 * generates an import statement for each one, wrapped up in a `runDashboardExtensions()`
 * function which can then be imported and executed in the Dashboard app.
 */
export function dashboardMetadataPlugin() {
    let configLoaderApi;
    let loadVendureConfigResult;
    return {
        name: 'vendure:dashboard-extensions-metadata',
        configResolved({ plugins }) {
            configLoaderApi = getConfigLoaderApi(plugins);
        },
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        async load(id) {
            var _a;
            if (id === resolvedVirtualModuleId) {
                const startTime = Date.now();
                this.debug('Loading dashboard extensions...');
                if (!loadVendureConfigResult) {
                    const configStart = Date.now();
                    loadVendureConfigResult = await configLoaderApi.getVendureConfig();
                    this.debug(`Loaded Vendure config in ${Date.now() - configStart}ms`);
                }
                const { pluginInfo } = loadVendureConfigResult;
                const resolveStart = Date.now();
                const pluginsWithExtensions = (_a = pluginInfo === null || pluginInfo === void 0 ? void 0 : pluginInfo.map(({ dashboardEntryPath, pluginPath, sourcePluginPath }) => {
                    if (!dashboardEntryPath) {
                        return null;
                    }
                    // For local plugins, use the sourcePluginPath to resolve the dashboard extension
                    const basePath = sourcePluginPath
                        ? path.dirname(sourcePluginPath)
                        : path.dirname(pluginPath);
                    const resolved = path.resolve(basePath, dashboardEntryPath);
                    this.debug(`Resolved extension path: ${resolved}`);
                    return resolved;
                }).filter(x => x != null)) !== null && _a !== void 0 ? _a : [];
                this.info(`Found ${pluginsWithExtensions.length} Dashboard extensions in ${Date.now() - resolveStart}ms`);
                this.debug(`Total dashboard extension loading completed in ${Date.now() - startTime}ms`);
                return `
                    export async function runDashboardExtensions() {
                        ${pluginsWithExtensions
                    .map(extension => {
                    return `await import(\`${pathToFileURL(extension)}\`);`;
                })
                    .join('\n')}
                }`;
            }
        },
    };
}
