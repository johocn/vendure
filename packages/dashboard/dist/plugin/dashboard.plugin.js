"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var DashboardPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardPlugin = void 0;
const core_1 = require("@vendure/core");
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = require("express-rate-limit");
const fs = __importStar(require("node:fs"));
const http = __importStar(require("node:http"));
const path = __importStar(require("node:path"));
const api_extensions_js_1 = require("./api/api-extensions.js");
const metrics_resolver_js_1 = require("./api/metrics.resolver.js");
const constants_js_1 = require("./constants.js");
const metrics_service_js_1 = require("./service/metrics.service.js");
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
let DashboardPlugin = DashboardPlugin_1 = class DashboardPlugin {
    constructor(processContext) {
        this.processContext = processContext;
        this.rateLimitRequests = process.env.NODE_ENV === 'production' ? 500 : 100000;
    }
    /**
     * @description
     * Set the plugin options
     */
    static init(options) {
        this.options = options;
        return DashboardPlugin_1;
    }
    configure(consumer) {
        if (this.processContext.isWorker) {
            return;
        }
        if (!DashboardPlugin_1.options) {
            core_1.Logger.warn(`DashboardPlugin's init() method was not called. The Dashboard UI will not be served.`, constants_js_1.loggerCtx);
            return;
        }
        const { route, appDir, viteDevServerPort = 5173 } = DashboardPlugin_1.options;
        core_1.Logger.verbose('Creating dashboard middleware', constants_js_1.loggerCtx);
        consumer.apply(this.createDynamicHandler(route, appDir, viteDevServerPort)).forRoutes(route);
        (0, core_1.registerPluginStartupMessage)('Dashboard UI', route);
    }
    createStaticServer(dashboardPath) {
        const limiter = (0, express_rate_limit_1.rateLimit)({
            windowMs: 60 * 1000,
            limit: this.rateLimitRequests,
            standardHeaders: true,
            legacyHeaders: false,
            // Content-hashed bundles under /assets/ are immutable and a single
            // page load fires ~190 chunk requests; counting them against the
            // bucket exhausts it within a few tabs (see #4665).
            skip: req => req.path.startsWith('/assets/'),
        });
        const dashboardServer = express_1.default.Router();
        dashboardServer.use(limiter);
        // Serve hashed assets with a long-lived immutable Cache-Control header
        // so CDNs and browsers can cache them indefinitely. This is safe because
        // Vite emits content-hashed filenames into /assets — a missing chunk
        // means a stale reference, so the explicit 404 handler below stops the
        // request from falling through to the SPA index.html shell, which would
        // otherwise be served with the asset's expected MIME and crash the app
        // on "Unexpected token '<'".
        dashboardServer.use('/assets', express_1.default.static(path.join(dashboardPath, 'assets'), {
            maxAge: '1y',
            immutable: true,
        }));
        dashboardServer.use('/assets', (_req, res) => res.status(404).end());
        dashboardServer.use(express_1.default.static(dashboardPath));
        dashboardServer.use((req, res) => {
            res.sendFile('index.html', { root: dashboardPath });
        });
        return dashboardServer;
    }
    async checkViteDevServer(port) {
        return new Promise(resolve => {
            const req = http.request({
                hostname: 'localhost',
                port,
                path: '/',
                method: 'HEAD',
                timeout: 1000,
            }, (res) => {
                resolve(res.statusCode !== undefined && res.statusCode < 400);
            });
            req.on('error', () => {
                resolve(false);
            });
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }
    checkBuiltFiles(appDir) {
        try {
            const indexPath = path.join(appDir, 'index.html');
            return fs.existsSync(indexPath);
        }
        catch (_a) {
            return false;
        }
    }
    createDefaultPage() {
        const limiter = (0, express_rate_limit_1.rateLimit)({
            windowMs: 60 * 1000,
            limit: this.rateLimitRequests,
            standardHeaders: true,
            legacyHeaders: false,
        });
        const defaultPageServer = express_1.default.Router();
        defaultPageServer.use(limiter);
        defaultPageServer.use((req, res) => {
            try {
                const htmlPath = path.join(__dirname, 'default-page.html');
                const defaultHtml = fs.readFileSync(htmlPath, 'utf8');
                res.setHeader('Content-Type', 'text/html');
                res.send(defaultHtml);
            }
            catch (error) {
                res.status(500).send(`Unable to load default page: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        return defaultPageServer;
    }
    createDynamicHandler(route, appDir, viteDevServerPort) {
        const limiter = (0, express_rate_limit_1.rateLimit)({
            windowMs: 60 * 1000,
            limit: this.rateLimitRequests,
            standardHeaders: true,
            legacyHeaders: false,
            // See note in createStaticServer — /assets/* is immutable and a
            // single page load fires ~190 chunk requests.
            skip: req => req.path.startsWith('/assets/'),
        });
        // Pre-create handlers to avoid recreating them on each request
        const proxyHandler = (0, core_1.createProxyHandler)({
            label: 'Dashboard Vite Dev Server',
            route,
            port: viteDevServerPort,
            basePath: route,
        });
        const staticServer = this.createStaticServer(appDir);
        const defaultPage = this.createDefaultPage();
        // Track current mode to log changes
        let currentMode = null;
        const dynamicRouter = express_1.default.Router();
        dynamicRouter.use(limiter);
        // Add status endpoint for polling (localhost only for security)
        dynamicRouter.get('/__status', (req, res, next) => {
            const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            const isLocalhost = clientIp === '127.0.0.1' ||
                clientIp === '::1' ||
                clientIp === '::ffff:127.0.0.1' ||
                clientIp === 'localhost';
            if (!isLocalhost) {
                return res.status(403).json({ error: 'Access denied' });
            }
            next();
        }, async (req, res) => {
            try {
                const isViteRunning = await this.checkViteDevServer(viteDevServerPort);
                const hasBuiltFiles = this.checkBuiltFiles(appDir);
                const mode = isViteRunning ? 'vite' : hasBuiltFiles ? 'built' : 'default';
                res.json({
                    viteRunning: isViteRunning,
                    hasBuiltFiles,
                    mode,
                });
            }
            catch (error) {
                res.status(500).json({
                    error: `Status check failed: ${error instanceof Error ? error.message : String(error)}`,
                });
            }
        });
        dynamicRouter.use(async (req, res, next) => {
            try {
                // Check for Vite dev server first (highest priority)
                const isViteRunning = await this.checkViteDevServer(viteDevServerPort);
                const hasBuiltFiles = this.checkBuiltFiles(appDir);
                // Determine new mode
                const staticMode = hasBuiltFiles ? 'built' : 'default';
                const newMode = isViteRunning ? 'vite' : staticMode;
                // Log mode change
                if (currentMode !== newMode) {
                    const modeDescriptions = {
                        vite: 'Vite dev server (with HMR)',
                        built: 'built static files',
                        default: 'default getting-started page',
                    };
                    if (currentMode !== null) {
                        core_1.Logger.info(`Dashboard mode changed: ${currentMode} → ${newMode} (serving ${modeDescriptions[newMode]})`, constants_js_1.loggerCtx);
                    }
                    currentMode = newMode;
                }
                // Route to appropriate handler
                if (isViteRunning) {
                    return proxyHandler(req, res, next);
                }
                if (hasBuiltFiles) {
                    return staticServer(req, res, next);
                }
                // Fall back to default page
                return defaultPage(req, res, next);
            }
            catch (error) {
                core_1.Logger.error(`Dashboard dynamic handler error: ${String(error)}`, constants_js_1.loggerCtx);
                res.status(500).send('Dashboard unavailable');
            }
        });
        return dynamicRouter;
    }
};
exports.DashboardPlugin = DashboardPlugin;
exports.DashboardPlugin = DashboardPlugin = DashboardPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        adminApiExtensions: {
            schema: api_extensions_js_1.adminApiExtensions,
            resolvers: [metrics_resolver_js_1.MetricsResolver],
        },
        providers: [metrics_service_js_1.MetricsService],
        configuration: config => {
            config.authOptions.customPermissions.push(constants_js_1.manageDashboardGlobalViews);
            config.settingsStoreFields['vendure.dashboard'] = [
                {
                    name: 'userSettings',
                    scope: core_1.SettingsStoreScopes.user,
                },
                {
                    name: 'globalSavedViews',
                    scope: core_1.SettingsStoreScopes.global,
                    requiresPermission: {
                        read: constants_js_1.manageDashboardGlobalViews.Read,
                        write: constants_js_1.manageDashboardGlobalViews.Write,
                    },
                },
                {
                    name: 'userSavedViews',
                    scope: core_1.SettingsStoreScopes.user,
                },
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __metadata("design:paramtypes", [core_1.ProcessContext])
], DashboardPlugin);
