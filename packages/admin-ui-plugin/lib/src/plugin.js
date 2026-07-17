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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AdminUiPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUiPlugin = void 0;
const shared_constants_1 = require("@vendure/common/lib/shared-constants");
const core_1 = require("@vendure/core");
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = require("express-rate-limit");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const api_extensions_1 = require("./api/api-extensions");
const metrics_resolver_1 = require("./api/metrics.resolver");
const constants_1 = require("./constants");
const metrics_service_1 = require("./service/metrics.service");
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
let AdminUiPlugin = AdminUiPlugin_1 = class AdminUiPlugin {
    constructor(configService, processContext) {
        this.configService = configService;
        this.processContext = processContext;
    }
    /**
     * @description
     * Set the plugin options
     */
    static init(options) {
        this.options = options;
        return AdminUiPlugin_1;
    }
    async configure(consumer) {
        if (this.processContext.isWorker) {
            return;
        }
        if (!AdminUiPlugin_1.options) {
            core_1.Logger.info(`AdminUiPlugin's init() method was not called. The Admin UI will not be served.`, constants_1.loggerCtx);
            return;
        }
        const { app, hostname, route, adminUiConfig } = AdminUiPlugin_1.options;
        const adminUiAppPath = AdminUiPlugin_1.isDevModeApp(app)
            ? path_1.default.join(app.sourcePath, 'src')
            : (app && app.path) || constants_1.DEFAULT_APP_PATH;
        const adminUiConfigPath = path_1.default.join(adminUiAppPath, 'vendure-ui-config.json');
        const indexHtmlPath = path_1.default.join(adminUiAppPath, 'index.html');
        const overwriteConfig = async () => {
            const uiConfig = this.getAdminUiConfig(adminUiConfig);
            await this.overwriteAdminUiConfig(adminUiConfigPath, uiConfig);
            await this.overwriteBaseHref(indexHtmlPath, route);
        };
        let port;
        if (AdminUiPlugin_1.isDevModeApp(app)) {
            port = app.port;
        }
        else {
            port = AdminUiPlugin_1.options.port;
        }
        if (AdminUiPlugin_1.isDevModeApp(app)) {
            core_1.Logger.info('Creating admin ui middleware (dev mode)', constants_1.loggerCtx);
            consumer
                .apply((0, core_1.createProxyHandler)({
                hostname,
                port,
                route,
                label: 'Admin UI',
                basePath: route,
            }))
                .forRoutes(route);
            consumer
                .apply((0, core_1.createProxyHandler)({
                hostname,
                port,
                route: 'sockjs-node',
                label: 'Admin UI live reload',
                basePath: 'sockjs-node',
            }))
                .forRoutes('sockjs-node');
            core_1.Logger.info('Compiling Admin UI app in development mode', constants_1.loggerCtx);
            app.compile().then(() => {
                core_1.Logger.info('Admin UI compiling and watching for changes...', constants_1.loggerCtx);
            }, (err) => {
                core_1.Logger.error(`Failed to compile: ${JSON.stringify(err)}`, constants_1.loggerCtx, err.stack);
            });
            await overwriteConfig();
        }
        else {
            core_1.Logger.info('Creating admin ui middleware (prod mode)', constants_1.loggerCtx);
            consumer.apply(this.createStaticServer(app)).forRoutes(route);
            if (app && typeof app.compile === 'function') {
                core_1.Logger.info('Compiling Admin UI app in production mode...', constants_1.loggerCtx);
                app.compile()
                    .then(overwriteConfig)
                    .then(() => {
                    core_1.Logger.info('Admin UI successfully compiled', constants_1.loggerCtx);
                }, (err) => {
                    core_1.Logger.error(`Failed to compile: ${JSON.stringify(err)}`, constants_1.loggerCtx, err.stack);
                });
            }
            else {
                await overwriteConfig();
            }
        }
        (0, core_1.registerPluginStartupMessage)('Admin UI', route);
    }
    createStaticServer(app) {
        const adminUiAppPath = (app && app.path) || constants_1.DEFAULT_APP_PATH;
        const limiter = (0, express_rate_limit_1.rateLimit)({
            windowMs: 60 * 1000,
            limit: process.env.NODE_ENV === 'production' ? 500 : 2000,
            standardHeaders: true,
            legacyHeaders: false,
        });
        const adminUiServer = express_1.default.Router();
        // This is a workaround for a type mismatch between express v5 (Vendure core)
        // and express v4 (several transitive dependencies). Can be removed once the
        // ecosystem has more significantly shifted to v5.
        adminUiServer.use(limiter);
        adminUiServer.use(express_1.default.static(adminUiAppPath));
        adminUiServer.use((req, res) => {
            res.sendFile('index.html', { root: adminUiAppPath });
        });
        return adminUiServer;
    }
    /**
     * Takes an optional AdminUiConfig provided in the plugin options, and returns a complete
     * config object for writing to disk.
     */
    getAdminUiConfig(partialConfig) {
        var _a, _b, _c, _d, _e;
        const { authOptions, apiOptions } = this.configService;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const options = AdminUiPlugin_1.options;
        const propOrDefault = (prop, defaultVal, isArray = false) => {
            var _a;
            if (isArray) {
                const isValidArray = !!partialConfig
                    ? !!((_a = partialConfig[prop]) === null || _a === void 0 ? void 0 : _a.length)
                    : false;
                return !!partialConfig && isValidArray ? partialConfig[prop] : defaultVal;
            }
            else {
                return partialConfig ? partialConfig[prop] || defaultVal : defaultVal;
            }
        };
        const serverTokenMethod = authOptions.tokenMethod;
        const serverUsesBearer = serverTokenMethod === 'bearer' ||
            (Array.isArray(serverTokenMethod) && serverTokenMethod.includes('bearer'));
        return {
            adminApiPath: propOrDefault('adminApiPath', apiOptions.adminApiPath),
            apiHost: propOrDefault('apiHost', 'auto'),
            apiPort: propOrDefault('apiPort', 'auto'),
            tokenMethod: propOrDefault('tokenMethod', serverUsesBearer ? 'bearer' : 'cookie'),
            authTokenHeaderKey: propOrDefault('authTokenHeaderKey', authOptions.authTokenHeaderKey || shared_constants_1.DEFAULT_AUTH_TOKEN_HEADER_KEY),
            channelTokenKey: propOrDefault('channelTokenKey', apiOptions.channelTokenKey || shared_constants_1.DEFAULT_CHANNEL_TOKEN_KEY),
            defaultLanguage: propOrDefault('defaultLanguage', constants_1.defaultLanguage),
            defaultLocale: propOrDefault('defaultLocale', constants_1.defaultLocale),
            availableLanguages: propOrDefault('availableLanguages', constants_1.defaultAvailableLanguages, true),
            availableLocales: propOrDefault('availableLocales', constants_1.defaultAvailableLocales, true),
            loginUrl: (_a = options.adminUiConfig) === null || _a === void 0 ? void 0 : _a.loginUrl,
            brand: (_b = options.adminUiConfig) === null || _b === void 0 ? void 0 : _b.brand,
            hideVendureBranding: propOrDefault('hideVendureBranding', ((_c = options.adminUiConfig) === null || _c === void 0 ? void 0 : _c.hideVendureBranding) || false),
            hideVersion: propOrDefault('hideVersion', ((_d = options.adminUiConfig) === null || _d === void 0 ? void 0 : _d.hideVersion) || false),
            loginImageUrl: (_e = options.adminUiConfig) === null || _e === void 0 ? void 0 : _e.loginImageUrl,
            cancellationReasons: propOrDefault('cancellationReasons', undefined),
        };
    }
    /**
     * Overwrites the parts of the admin-ui app's `vendure-ui-config.json` file relating to connecting to
     * the server admin API.
     */
    async overwriteAdminUiConfig(adminUiConfigPath, config) {
        try {
            const content = await this.pollForFile(adminUiConfigPath);
        }
        catch (e) {
            core_1.Logger.error(e.message, constants_1.loggerCtx);
            throw e;
        }
        try {
            await fs_extra_1.default.writeFile(adminUiConfigPath, JSON.stringify(config, null, 2));
        }
        catch (e) {
            throw new Error('[AdminUiPlugin] Could not write vendure-ui-config.json file:\n' + JSON.stringify(e.message));
        }
        core_1.Logger.verbose('Applied configuration to vendure-ui-config.json file', constants_1.loggerCtx);
    }
    /**
     * Overwrites the parts of the admin-ui app's `vendure-ui-config.json` file relating to connecting to
     * the server admin API.
     */
    async overwriteBaseHref(indexHtmlPath, baseHref) {
        let indexHtmlContent;
        try {
            indexHtmlContent = await this.pollForFile(indexHtmlPath);
        }
        catch (e) {
            core_1.Logger.error(e.message, constants_1.loggerCtx);
            throw e;
        }
        try {
            const withCustomBaseHref = indexHtmlContent.replace(/<base href=".+"\s*\/>/, `<base href="/${baseHref}/" />`);
            await fs_extra_1.default.writeFile(indexHtmlPath, withCustomBaseHref);
        }
        catch (e) {
            throw new Error('[AdminUiPlugin] Could not write index.html file:\n' + JSON.stringify(e.message));
        }
        core_1.Logger.verbose(`Applied baseHref "/${baseHref}/" to index.html file`, constants_1.loggerCtx);
    }
    /**
     * It might be that the ui-devkit compiler has not yet copied the config
     * file to the expected location (particularly when running in watch mode),
     * so polling is used to check multiple times with a delay.
     */
    async pollForFile(filePath) {
        const maxRetries = 10;
        const retryDelay = 200;
        let attempts = 0;
        const pause = () => new Promise(resolve => setTimeout(resolve, retryDelay));
        while (attempts < maxRetries) {
            try {
                core_1.Logger.verbose(`Checking for admin ui file: ${filePath}`, constants_1.loggerCtx);
                const configFileContent = await fs_extra_1.default.readFile(filePath, 'utf-8');
                return configFileContent;
            }
            catch (e) {
                attempts++;
                core_1.Logger.verbose(`Unable to locate admin ui file: ${filePath} (attempt ${attempts})`, constants_1.loggerCtx);
            }
            await pause();
        }
        throw new Error(`Unable to locate admin ui file: ${filePath}`);
    }
    static isDevModeApp(app) {
        if (!app) {
            return false;
        }
        return !!app.sourcePath;
    }
};
exports.AdminUiPlugin = AdminUiPlugin;
exports.AdminUiPlugin = AdminUiPlugin = AdminUiPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        adminApiExtensions: {
            schema: () => (0, api_extensions_1.getApiExtensions)(),
            resolvers: () => [metrics_resolver_1.MetricsResolver],
        },
        providers: [metrics_service_1.MetricsService],
        compatibility: '^3.0.0',
    }),
    __metadata("design:paramtypes", [core_1.ConfigService,
        core_1.ProcessContext])
], AdminUiPlugin);
//# sourceMappingURL=plugin.js.map