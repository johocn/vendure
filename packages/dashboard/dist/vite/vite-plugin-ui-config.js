import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { getUiConfig } from './utils/ui-config.js';
import { getConfigLoaderApi } from './vite-plugin-config-loader.js';
const virtualModuleId = 'virtual:vendure-ui-config';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
/**
 * Resolves the @vendure/dashboard version from its package.json.
 * Uses Node's module resolution via createRequire so it works regardless
 * of package manager layout (npm, pnpm, yarn PnP).
 */
function readDashboardVersion(root) {
    const rootRequire = createRequire(root.endsWith('/') ? root : `${root}/`);
    try {
        // Resolve the main entry point of @vendure/dashboard, then walk up
        // to find its package.json. This respects Node's module resolution
        // regardless of package manager layout (npm, pnpm, yarn PnP).
        const mainPath = rootRequire.resolve('@vendure/dashboard');
        let dir = dirname(mainPath);
        while (dir !== dirname(dir)) {
            try {
                const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
                if (pkg.name === '@vendure/dashboard') {
                    return pkg.version;
                }
            }
            catch (_a) {
                /* no package.json at this level */
            }
            dir = dirname(dir);
        }
    }
    catch (_b) {
        /* module resolution failed */
    }
    return 'unknown';
}
export function uiConfigPlugin(options = {}) {
    let configLoaderApi;
    let vendureConfig;
    let dashboardVersion;
    return {
        name: 'vendure:dashboard-ui-config',
        configResolved(config) {
            configLoaderApi = getConfigLoaderApi(config.plugins);
            dashboardVersion = readDashboardVersion(config.root);
        },
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        async load(id) {
            if (id === resolvedVirtualModuleId) {
                if (!vendureConfig) {
                    const result = await configLoaderApi.getVendureConfig();
                    vendureConfig = result.vendureConfig;
                }
                const config = getUiConfig(vendureConfig, options);
                return `
                    export const uiConfig = ${JSON.stringify(Object.assign(Object.assign({}, config), { version: dashboardVersion }))}
                `;
            }
        },
    };
}
