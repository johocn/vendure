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
var GraphiqlPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphiqlPlugin = void 0;
const core_1 = require("@vendure/core");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const constants_1 = require("./constants");
const graphiql_service_1 = require("./graphiql.service");
/**
 * @description
 * This plugin provides a GraphiQL UI for exploring and testing the Vendure GraphQL APIs.
 *
 * It adds routes `/graphiql/admin` and `/graphiql/shop` which serve the GraphiQL interface
 * for the respective APIs.
 *
 * ## Installation
 *
 * ```ts
 * import { GraphiqlPlugin } from '\@vendure/graphiql-plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     GraphiqlPlugin.init({
 *       route: 'graphiql', // Optional, defaults to 'graphiql'
 *     }),
 *   ],
 * };
 * ```
 *
 * ## Custom API paths
 *
 * By default, the plugin automatically reads the Admin API and Shop API paths from your Vendure configuration.
 *
 * If you need to override these paths, you can specify them explicitly:
 *
 * ```typescript
 * GraphiQLPlugin.init({
 *     route: 'my-custom-route', // defaults to `graphiql`
 * });
 * ```
 *
 * ## Query parameters
 *
 * You can add the following query parameters to the GraphiQL URL:
 *
 * - `?query=...` - Pre-populate the query editor with a GraphQL query.
 * - `?embeddedMode=true` - This renders the editor in embedded mode, which hides the header and
 *    the API switcher. This is useful for embedding GraphiQL in other applications such as documentation.
 *    In this mode, the editor also does not persist changes across reloads.
 *
 * @docsCategory core plugins/GraphiqlPlugin
 */
let GraphiqlPlugin = GraphiqlPlugin_1 = class GraphiqlPlugin {
    constructor(processContext, configService, graphiQLService) {
        this.processContext = processContext;
        this.configService = configService;
        this.graphiQLService = graphiQLService;
    }
    /**
     * Initialize the plugin with the given options.
     */
    static init(options = {}) {
        this.options = Object.assign(Object.assign({}, options), { route: options.route || 'graphiql' });
        return GraphiqlPlugin_1;
    }
    configure(consumer) {
        if (!this.processContext.isServer) {
            return;
        }
        const adminRoute = GraphiqlPlugin_1.options.route + '/admin';
        const shopRoute = GraphiqlPlugin_1.options.route + '/shop';
        consumer.apply(this.createStaticServer()).forRoutes(adminRoute);
        consumer.apply(this.createStaticServer()).forRoutes(shopRoute);
        // Add middleware for serving assets
        consumer.apply(this.createAssetsServer()).forRoutes('/graphiql/assets/*path');
        (0, core_1.registerPluginStartupMessage)('GraphiQL Admin', adminRoute);
        (0, core_1.registerPluginStartupMessage)('GraphiQL Shop', shopRoute);
    }
    createStaticServer() {
        const distDir = node_path_1.default.join(__dirname, '../dist/graphiql');
        const adminApiUrl = this.graphiQLService.getAdminApiUrl();
        const shopApiUrl = this.graphiQLService.getShopApiUrl();
        return (req, res) => {
            try {
                const indexHtmlPath = node_path_1.default.join(distDir, 'index.html');
                if (node_fs_1.default.existsSync(indexHtmlPath)) {
                    // Read the HTML file
                    let html = node_fs_1.default.readFileSync(indexHtmlPath, 'utf-8');
                    // Inject API URLs
                    html = html.replace('</head>', `<script>
                                window.GRAPHIQL_SETTINGS = {
                                    adminApiUrl: "${adminApiUrl}",
                                    shopApiUrl: "${shopApiUrl}"
                                };
                            </script>
                            </head>`);
                    return res.send(html);
                }
                throw new Error(`GraphiQL UI not found: ${indexHtmlPath}`);
            }
            catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                core_1.Logger.error(`Error serving GraphiQL: ${errorMessage}`, 'GraphiQLPlugin');
                return res.status(500).send('An error occurred while rendering GraphiQL');
            }
        };
    }
    createAssetsServer() {
        const distDir = node_path_1.default.join(__dirname, '../dist/graphiql');
        return (req, res, next) => {
            try {
                // Extract asset path from URL
                const assetPath = req.params[0] || req.params.path || '';
                const filePath = node_path_1.default.join(distDir, 'assets', assetPath.toString());
                if (node_fs_1.default.existsSync(filePath)) {
                    return res.sendFile(assetPath.toString(), { root: node_path_1.default.join(distDir, 'assets') });
                }
                else {
                    return res.status(404).send('Asset not found');
                }
            }
            catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                core_1.Logger.error(`Error serving static asset: ${errorMessage}`, constants_1.loggerCtx);
                return res.status(500).send('An error occurred while serving static asset');
            }
        };
    }
};
exports.GraphiqlPlugin = GraphiqlPlugin;
exports.GraphiqlPlugin = GraphiqlPlugin = GraphiqlPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            graphiql_service_1.GraphiQLService,
            {
                provide: constants_1.PLUGIN_INIT_OPTIONS,
                useFactory: () => GraphiqlPlugin.options,
            },
        ],
        configuration: config => {
            // disable GraphQL playground in config
            config.apiOptions.adminApiPlayground = false;
            config.apiOptions.shopApiPlayground = false;
            return config;
        },
        exports: [graphiql_service_1.GraphiQLService],
        compatibility: '^3.0.0',
    }),
    __metadata("design:paramtypes", [core_1.ProcessContext,
        core_1.ConfigService,
        graphiql_service_1.GraphiQLService])
], GraphiqlPlugin);
//# sourceMappingURL=plugin.js.map