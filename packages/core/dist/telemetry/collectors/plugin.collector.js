"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginCollector = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../../config/config.service");
const plugin_metadata_1 = require("../../plugin/plugin-metadata");
/**
 * Known Vendure plugins mapped to their npm package names.
 * This is more reliable than require.cache inspection which fails with ESM/TypeScript.
 */
const KNOWN_VENDURE_PLUGINS = {
    // @vendure/core
    DefaultSearchPlugin: '@vendure/core',
    DefaultJobQueuePlugin: '@vendure/core',
    DefaultSchedulerPlugin: '@vendure/core',
    // @vendure/asset-server-plugin
    AssetServerPlugin: '@vendure/asset-server-plugin',
    // @vendure/email-plugin
    EmailPlugin: '@vendure/email-plugin',
    // @vendure/admin-ui-plugin
    AdminUiPlugin: '@vendure/admin-ui-plugin',
    // @vendure/dashboard
    DashboardPlugin: '@vendure/dashboard',
    // @vendure/job-queue-plugin
    BullMQJobQueuePlugin: '@vendure/job-queue-plugin',
    // @vendure/graphiql-plugin
    GraphiqlPlugin: '@vendure/graphiql-plugin',
    // @vendure/harden-plugin
    HardenPlugin: '@vendure/harden-plugin',
    // Community plugins (moved to @vendure-community/*)
    ElasticsearchPlugin: '@vendure-community/elasticsearch-plugin',
    SentryPlugin: '@vendure-community/sentry-plugin',
    StripePlugin: '@vendure-community/stripe-plugin',
    MolliePlugin: '@vendure-community/mollie-plugin',
    BraintreePlugin: '@vendure-community/braintree-plugin',
};
/**
 * Collects information about plugins used in the Vendure installation.
 * Detects npm packages by checking if the plugin originates from node_modules.
 * Custom plugin names are NOT collected for privacy.
 */
let PluginCollector = class PluginCollector {
    constructor(configService) {
        this.configService = configService;
    }
    collect() {
        try {
            const plugins = this.configService.plugins;
            const npmPlugins = new Set();
            let customCount = 0;
            for (const plugin of plugins) {
                try {
                    const npmPackage = this.findNpmPackage(plugin);
                    if (npmPackage) {
                        npmPlugins.add(npmPackage);
                    }
                    else {
                        customCount++;
                    }
                }
                catch (_a) {
                    customCount++;
                }
            }
            return {
                npm: Array.from(npmPlugins).sort((a, b) => a.localeCompare(b)),
                customCount,
            };
        }
        catch (_b) {
            return { npm: [], customCount: 0 };
        }
    }
    /**
     * Finds the npm package name for a plugin.
     * First checks against known Vendure plugins, then falls back to require.cache inspection.
     */
    findNpmPackage(plugin) {
        var _a;
        const pluginClass = (0, plugin_metadata_1.isDynamicModule)(plugin) ? plugin.module : plugin;
        if (!pluginClass) {
            return undefined;
        }
        const pluginName = (_a = pluginClass.name) !== null && _a !== void 0 ? _a : 'unknown';
        // First, check against known Vendure plugins (most reliable)
        const knownPackage = KNOWN_VENDURE_PLUGINS[pluginName];
        if (knownPackage) {
            return knownPackage;
        }
        // Fall back to require.cache inspection for third-party npm plugins
        return this.findInRequireCache(pluginClass);
    }
    /**
     * Searches the require cache for a plugin class.
     * This is a fallback for third-party npm plugins not in our known list.
     */
    findInRequireCache(pluginClass) {
        // Check if require.cache is available (may not be in ESM-only environments)
        if (typeof require === 'undefined' || !require.cache) {
            return undefined;
        }
        try {
            for (const [modulePath, moduleObj] of Object.entries(require.cache)) {
                if (!(moduleObj === null || moduleObj === void 0 ? void 0 : moduleObj.exports) || !modulePath.includes('node_modules')) {
                    continue;
                }
                try {
                    const exports = moduleObj.exports;
                    // Direct match or default export match
                    if (exports === pluginClass || (exports === null || exports === void 0 ? void 0 : exports.default) === pluginClass) {
                        return this.extractPackageName(modulePath);
                    }
                    // Check named exports
                    if (typeof exports === 'object' && exports !== null) {
                        const exportValues = Object.values(exports);
                        if (exportValues.includes(pluginClass)) {
                            return this.extractPackageName(modulePath);
                        }
                    }
                }
                catch (_a) {
                    // Skip modules with problematic exports
                    continue;
                }
            }
        }
        catch (_b) {
            // Ignore errors accessing require.cache
        }
        return undefined;
    }
    /**
     * Extracts the npm package name from a node_modules path.
     * Handles both scoped (@scope/package) and unscoped packages.
     */
    extractPackageName(modulePath) {
        const nodeModulesIndex = modulePath.lastIndexOf('node_modules');
        if (nodeModulesIndex === -1) {
            return undefined;
        }
        const pathAfterNodeModules = modulePath.slice(nodeModulesIndex + 'node_modules/'.length);
        const parts = pathAfterNodeModules.split(/[/\\]/);
        if (parts[0].startsWith('@')) {
            // Scoped package: @scope/package
            return `${parts[0]}/${parts[1]}`;
        }
        return parts[0];
    }
};
exports.PluginCollector = PluginCollector;
exports.PluginCollector = PluginCollector = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], PluginCollector);
//# sourceMappingURL=plugin.collector.js.map