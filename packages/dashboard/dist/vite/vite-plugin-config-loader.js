import { compile } from './utils/compiler.js';
import { debugLogger } from './utils/logger.js';
export const configLoaderName = 'vendure:config-loader';
/**
 * This Vite plugin loads the VendureConfig from the specified file path, and
 * makes it available to other plugins via the `ConfigLoaderApi`.
 */
export function configLoaderPlugin(options) {
    let result;
    const onConfigLoaded = [];
    return {
        name: configLoaderName,
        async buildStart() {
            this.info(`Loading Vendure config. This can take a short while depending on the size of your project...`);
            try {
                const startTime = Date.now();
                result = await compile(Object.assign(Object.assign({}, options), { logger: process.env.LOG
                        ? debugLogger
                        : {
                            info: (message) => this.info(message),
                            warn: (message) => this.warn(message),
                            debug: (message) => this.debug(message),
                            error: (message) => this.error(message),
                        } }));
                const endTime = Date.now();
                const duration = endTime - startTime;
                const pluginNames = result.pluginInfo
                    .map(p => `${p.name} ${p.sourcePluginPath ? '(local)' : '(npm)'}`)
                    .join(', ');
                this.info(`Found ${result.pluginInfo.length} plugins: ${pluginNames}`);
                this.info(`Vendure config loaded (using export "${result.exportedSymbolName}") in ${duration}ms`);
            }
            catch (e) {
                if (e instanceof Error) {
                    const message = [
                        e.message,
                        `If you are using a monorepo, you may need to provide a custom pathAdapter to resolve the paths correctly.`,
                    ].join('\n');
                    this.error(`Error loading Vendure config: ${message}`);
                }
            }
            onConfigLoaded.forEach(fn => fn());
        },
        api: {
            getVendureConfig() {
                if (result) {
                    return Promise.resolve(result);
                }
                else {
                    return new Promise(resolve => {
                        onConfigLoaded.push(() => {
                            resolve(result);
                        });
                    });
                }
            },
        },
    };
}
/**
 * Inter-plugin dependencies implemented following the pattern given here:
 * https://rollupjs.org/plugin-development/#direct-plugin-communication
 */
export function getConfigLoaderApi(plugins) {
    const parentPlugin = plugins.find(plugin => plugin.name === configLoaderName);
    if (!parentPlugin) {
        throw new Error(`This plugin depends on the "${configLoaderName}" plugin.`);
    }
    return parentPlugin.api;
}
