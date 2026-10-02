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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.devConfig = void 0;
const admin_ui_plugin_1 = require("@vendure/admin-ui-plugin");
const asset_server_plugin_1 = require("@vendure/asset-server-plugin");
const shared_constants_1 = require("@vendure/common/lib/shared-constants");
const core_1 = require("@vendure/core");
const plugin_1 = require("@vendure/dashboard/plugin");
const email_plugin_1 = require("@vendure/email-plugin");
const graphiql_plugin_1 = require("@vendure/graphiql-plugin");
const telemetry_plugin_1 = require("@vendure/telemetry-plugin");
require("dotenv/config");
const path_1 = __importDefault(require("path"));
const cjk_plugin_1 = require("@vendure/cjk-plugin");
// 注意：ReviewsPlugin/FloorBuilderPlugin/NavModifierPlugin 为开发演示插件，
// 改为惰性 require（见 devOnlyPlugins），避免生产模式静态 require 缺失的 test-plugins 产物。
const alipay_plugin_1 = require("@vendure/alipay-plugin");
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
const oss_plugin_1 = require("@vendure/oss-plugin");
const phone_auth_plugin_1 = require("@vendure/phone-auth-plugin");
const wechat_auth_plugin_1 = require("@vendure/wechat-auth-plugin");
const douyin_auth_plugin_1 = require("@vendure/douyin-auth-plugin");
const order_timeout_plugin_1 = require("@vendure/order-timeout-plugin");
const invoice_plugin_1 = require("@vendure/invoice-plugin");
const logistics_plugin_1 = require("@vendure/logistics-plugin");
const delivery_gateway_plugin_1 = require("@vendure/delivery-gateway-plugin");
const group_buy_plugin_1 = require("@vendure/group-buy-plugin");
const flash_sale_plugin_1 = require("@vendure/flash-sale-plugin");
const distribution_plugin_1 = require("@vendure/distribution-plugin");
const eco_plugin_1 = require("@vendure/eco-plugin");
const product_survey_plugin_1 = require("@vendure/product-survey-plugin");
const redis_stock_plugin_1 = require("@vendure/redis-stock-plugin");
const logistics_api_plugin_1 = require("@vendure/logistics-api-plugin");
const invoice_pdf_plugin_1 = require("@vendure/invoice-pdf-plugin");
const recharge_card_plugin_1 = require("@vendure/recharge-card-plugin");
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const member_level_plugin_1 = require("@vendure/member-level-plugin");
const vcash_pos_plugin_1 = require("@vendure/vcash-pos-plugin");
const vcash_offline_plugin_1 = require("@vendure/vcash-offline-plugin");
const checkin_plugin_1 = require("@vendure/checkin-plugin");
const review_plugin_1 = require("@vendure/review-plugin");
const wechat_subscribe_message_plugin_1 = require("@vendure/wechat-subscribe-message-plugin");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const delivery_plugin_1 = require("@vendure/delivery-plugin");
const sales_plugin_1 = require("@vendure/sales-plugin");
const sales_plugin_2 = require("@vendure/sales-plugin");
const marketplace_plugin_1 = require("@vendure/marketplace-plugin");
const customer_service_plugin_1 = require("@vendure/customer-service-plugin");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const message_plugin_1 = require("@vendure/message-plugin");
const operations_plugin_1 = require("@vendure/operations-plugin");
const pre_sale_plugin_1 = require("@vendure/pre-sale-plugin");
const live_streaming_plugin_1 = require("@vendure/live-streaming-plugin");
const shop_plugin_1 = require("@vendure/shop-plugin");
const pickup_plugin_1 = require("@vendure/pickup-plugin");
const shop_template_plugin_1 = require("@vendure/shop-template-plugin");
const favorite_plugin_1 = require("@vendure/favorite-plugin");
// 本地联调默认注入 REDEMPTION_KEY（AES-GCM/HMAC 密钥，64 hex chars）
if (!process.env.REDEMPTION_KEY) {
    process.env.REDEMPTION_KEY = 'd'.repeat(64); // dev only：生产由运维注入
}
// 生产模式（dist/）跳过开发演示插件，避免静态 import require 缺失的 test-plugins 产物
// IS_PROD=true 环境变量：dashboard vite 构建时 config-loader 编译到临时目录，
// __dirname 非 dist，需用环境变量显式标记生产，跳过 test-plugins
const IS_PROD = path_1.default.basename(__dirname) === 'dist' || process.env.IS_PROD === 'true';
const devOnlyPlugins = IS_PROD
    ? []
    : (() => {
        const { ReviewsPlugin } = require('./test-plugins/reviews/reviews-plugin');
        const { FloorBuilderPlugin } = require('./test-plugins/floor-builder');
        const { NavModifierPlugin } = require('./test-plugins/nav-modifier-plugin/nav-modifier-plugin');
        return [ReviewsPlugin, FloorBuilderPlugin, NavModifierPlugin];
    })();
// 统一解析 dev-server 目录：dev 模式 __dirname=packages/dev-server，prod 模式 __dirname=packages/dev-server/dist
const devServerDir = path_1.default.basename(__dirname) === 'dist' ? path_1.default.dirname(__dirname) : __dirname;
const IS_INSTRUMENTED = process.env.IS_INSTRUMENTED === 'true';
let ReadonlySettingsTestPlugin = class ReadonlySettingsTestPlugin {
    constructor(settingsStoreService, requestContextService) {
        this.settingsStoreService = settingsStoreService;
        this.requestContextService = requestContextService;
    }
    async onApplicationBootstrap() {
        const ctx = await this.requestContextService.create({ apiType: 'admin' });
        await this.settingsStoreService.set(ctx, 'ReadonlyTest.buildVersion', 'v3.5.2');
        await this.settingsStoreService.set(ctx, 'ReadonlyTest.buildMeta', {
            buildDate: '2026-03-06',
            commit: 'd0384f3ed',
            features: ['settings-store-ui', 'option-groups'],
        });
    }
};
ReadonlySettingsTestPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        configuration: config => {
            config.settingsStoreFields = {
                ...config.settingsStoreFields,
                ReadonlyTest: [
                    { name: 'buildVersion', readonly: true },
                    { name: 'buildMeta', readonly: true },
                ],
            };
            return config;
        },
    }),
    __metadata("design:paramtypes", [typeof (_a = typeof core_1.SettingsStoreService !== "undefined" && core_1.SettingsStoreService) === "function" ? _a : Object, typeof (_b = typeof core_1.RequestContextService !== "undefined" && core_1.RequestContextService) === "function" ? _b : Object])
], ReadonlySettingsTestPlugin);
/**
 * 源头修复（2026-09-04）：本项目为多租户（cjk 租户渠道），非 Vendure marketplace 多商户。
 * MarketplacePlugin 会把挂租户渠道的商品通过 MarketplaceSellerStrategy 拆出 Seller「配送子单」
 * （aggregateOrderId 幽灵子单，类型 delivery、state ArrangingPayment、数量与聚合单一致），
 * 造成客户侧"一单变两单"与数量/金额翻倍。
 * 本插件强制把 orderSellerStrategy 恢复为 DefaultOrderSellerStrategy（不拆分、不再赋 sellerChannel），
 * 从根本上不再生成 Seller 子单。必须置于 plugins 数组最末，使本 configuration 钩子覆盖 MarketplacePlugin 的赋值。
 */
let DisableSellerSplitPlugin = class DisableSellerSplitPlugin {
};
DisableSellerSplitPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        configuration: config => {
            config.orderOptions.orderSellerStrategy = new core_1.DefaultOrderSellerStrategy();
            return config;
        },
    })
], DisableSellerSplitPlugin);
/**
 * Config settings used during development
 */
exports.devConfig = {
    apiOptions: {
        port: Number(process.env.API_PORT) || shared_constants_1.API_PORT,
        adminApiPath: shared_constants_1.ADMIN_API_PATH,
        adminApiPlayground: {
            settings: {
                'request.credentials': 'include',
            },
        },
        adminApiDebug: true,
        shopApiPath: shared_constants_1.SHOP_API_PATH,
        shopApiPlayground: {
            settings: {
                'request.credentials': 'include',
            },
        },
        shopApiDebug: true,
        middleware: [
            {
                handler: (req, res, next) => {
                    if (req.path.startsWith('/assets') || req.url.startsWith('/assets')) {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                    }
                    next();
                },
                route: '/assets',
            },
            {
                // 修复：GET 访问 /admin-api 且不含 GraphQL query 参数时，Apollo 默认返回 400，
                // 导致访问 e.joho.cn 时浏览器控制台出现 "400 (Bad Request)"。
                // 例如 Dashboard 的 admin-api 客户端会拼接 ?languageCode=zh_Hans 发起 GET。
                // 这里对无 query 的 GET 返回 200 的 GraphQL 错误信封，避免 400 刷屏。
                handler: (req, res, next) => {
                    if (req.method === 'GET' && !req.query.query) {
                        res.status(200).json({
                            data: null,
                            errors: [
                                {
                                    message: 'GET requests to the GraphQL Admin API require a "query" parameter. Use POST or include ?query=.',
                                    extensions: { code: 'BAD_REQUEST' },
                                },
                            ],
                        });
                        return;
                    }
                    next();
                },
                route: '/admin-api',
            },
        ],
    },
    authOptions: {
        disableAuth: false,
        tokenMethod: ['bearer', 'cookie', 'api-key'],
        requireVerification: false,
        customPermissions: [],
        cookieOptions: {
            secret: 'abc',
        },
    },
    dbConnectionOptions: {
        synchronize: false,
        logging: false,
        migrations: [path_1.default.join(devServerDir, 'migrations/*.ts')],
        ...getDbConfig(),
    },
    paymentOptions: {
        paymentMethodHandlers: [core_1.dummyPaymentHandler],
    },
    orderOptions: {
        orderItemPriceCalculationStrategy: new sales_plugin_2.SalesOrderItemPriceCalculationStrategy(),
        orderByCodeAccessStrategy: new core_1.DefaultOrderByCodeAccessStrategy('7d'),
    },
    settingsStoreFields: {
        MyPlugin: [
            {
                name: 'globalVal',
            },
            {
                name: 'userVal',
                scope: core_1.SettingsStoreScopes.user,
            },
        ],
    },
    customFields: {
        Collection: [
            { name: 'floorEnabled', type: 'boolean', defaultValue: false, public: true,
                ui: { component: 'boolean-form-input' } },
            { name: 'floorTitle', type: 'string', public: true,
                ui: { component: 'text-form-input' } },
            { name: 'floorSubtitle', type: 'string', public: true,
                ui: { component: 'text-form-input' } },
            { name: 'floorLayout', type: 'string', defaultValue: 'double_grid', public: true,
                ui: {
                    component: 'select-form-input',
                    options: [
                        { value: 'single_scroll', label: '单列横滑' },
                        { value: 'double_grid', label: '双列网格' },
                        { value: 'triple_grid', label: '三列网格' },
                        { value: 'hero_with_list', label: '大图+列表' },
                    ],
                } },
            { name: 'floorSortOrder', type: 'int', defaultValue: 0, public: true },
            { name: 'floorMaxScreens', type: 'int', defaultValue: 3, public: true },
            {
                name: 'floorTheme', type: 'struct', public: true, fields: [
                    { name: 'primaryColor', type: 'string' },
                    { name: 'backgroundColor', type: 'string' },
                    { name: 'titleIcon', type: 'string' },
                ],
            },
            {
                name: 'floorItemConfig', type: 'struct', list: true, public: true, fields: [
                    { name: 'productId', type: 'string' },
                    { name: 'size', type: 'string',
                        ui: { component: 'select-form-input',
                            options: [
                                { value: 'small', label: '小' },
                                { value: 'medium', label: '中' },
                                { value: 'large', label: '大' },
                            ] } },
                    { name: 'highlighted', type: 'boolean' },
                    { name: 'label', type: 'string' },
                ],
            },
            {
                name: 'floorSchedule', type: 'struct', public: true, fields: [
                    { name: 'startAt', type: 'datetime' },
                    { name: 'endAt', type: 'datetime' },
                ],
            },
        ],
        Channel: [
            // 店铺装修字段（对齐生产 + 装修需要，Task 6）
            { name: 'displayTemplate', type: 'string', defaultValue: 'standard', public: true },
            { name: 'themeId', type: 'string', defaultValue: 'taobao-orange', public: true },
            { name: 'shopName', type: 'string', public: true },
            { name: 'shopLogo', type: 'string', public: true },
            { name: 'shopIntro', type: 'string', public: true },
            { name: 'servicePhone', type: 'string', public: true },
            // shopContent 存装修 JSON 字符串（Vendure 3.6.4 无 type:'json'，用 text 承载序列化 JSON）
            { name: 'shopContent', type: 'text', public: true },
            // detailConfig 存商品详情页装修 JSON 字符串（结构化 schema 见 nshop layers/base/app/utils/detail-config.ts）
            { name: 'detailConfig', type: 'text', public: true },
            // orderDetailConfig 存订单详情页装修 JSON（结构化 schema 见 nshop layers/base/app/utils/order-config.ts）
            { name: 'orderDetailConfig', type: 'text', public: true },
            // orderListConfig 存订单列表版式 JSON（本期仅 card）
            { name: 'orderListConfig', type: 'text', public: true },
            // promoSchemes/serviceSchemes 存频道促销/服务方案库 JSON（[{code,text:{zh_Hans,en}}]，勾选启用即入列）
            { name: 'promoSchemes', type: 'text', public: true },
            { name: 'serviceSchemes', type: 'text', public: true },
            // 分类/购物车/我的 页面装修 JSON（web-admin 装修表单写入，C 端按页合并）
            { name: 'pageCategoryConfig', type: 'text', public: true },
            { name: 'pageCartConfig', type: 'text', public: true },
            { name: 'pageProfileConfig', type: 'text', public: true },
        ],
        Customer: [],
        Fulfillment: [],
        Order: [],
        Product: [],
        Promotion: [],
    },
    schedulerOptions: {
        // 任务只在 worker 进程执行：验收要求「停掉 worker 时预留单不被释放」以证明是真定时任务。
        // 代价：只用 `npm run dev:server` 时不会有任何 ScheduledTask（含 OrderTimeoutPlugin 补偿扫描、
        // 秒杀状态转换）在跑 —— 本地必须用 `npm run dev`（concurrently 同时起 server + worker），
        // 生产必须常驻一个 worker 进程（见 Task 4.9 手册章节）。
        runTasksInWorkerOnly: true,
        tasks: [core_1.cleanSessionsTask, core_1.cleanOrphanedSettingsStoreTask],
    },
    logger: new core_1.DefaultLogger({ level: core_1.LogLevel.Verbose }),
    importExportOptions: {
        importAssetsDir: path_1.default.join(devServerDir, 'import-assets'),
    },
    plugins: [
        // MultivendorPlugin.init({
        //     platformFeePercent: 10,
        //     platformFeeSKU: 'FEE',
        // }),
        ReadonlySettingsTestPlugin,
        // FieldTestPlugin,
        ...devOnlyPlugins,
        graphiql_plugin_1.GraphiqlPlugin.init(),
        asset_server_plugin_1.AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path_1.default.join(devServerDir, 'assets'),
        }),
        core_1.DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: false }),
        // Enable if you need to debug the job queue
        // BullMQJobQueuePlugin.init({}),
        core_1.DefaultJobQueuePlugin.init({}),
        // JobQueueTestPlugin.init({ queueCount: 10 }),
        core_1.DefaultSchedulerPlugin.init({}),
        email_plugin_1.EmailPlugin.init({
            devMode: true,
            route: 'mailbox',
            handlers: email_plugin_1.defaultEmailHandlers,
            templateLoader: new email_plugin_1.FileBasedTemplateLoader(path_1.default.join(devServerDir, '../email-plugin/templates')),
            outputPath: path_1.default.join(devServerDir, 'test-emails'),
            globalTemplateVars: {
                verifyEmailAddressUrl: 'http://localhost:4201/verify',
                passwordResetUrl: 'http://localhost:4201/reset-password',
                changeEmailAddressUrl: 'http://localhost:4201/change-email-address',
            },
        }),
        ...(IS_INSTRUMENTED ? [telemetry_plugin_1.TelemetryPlugin.init({})] : []),
        // AdminUiPlugin requires pre-built admin-ui bundle. Build with:
        // cd packages/admin-ui && npm run build:app
        admin_ui_plugin_1.AdminUiPlugin.init({
            route: 'admin',
            port: 5001,
            adminUiConfig: {},
        }),
        plugin_1.DashboardPlugin.init({
            route: 'dashboard',
            appDir: path_1.default.join(devServerDir, './dist'),
        }),
        cjk_plugin_1.CjkPlugin.init({
            i18n: { enabled: true },
            regions: { enabled: true },
            tenant: { enabled: true, defaultPublicDomain: process.env.DEFAULT_PUBLIC_DOMAIN || 'www.youshop.cn' },
            cod: { enabled: true },
            storePickup: { enabled: true },
            pickupPoint: { enabled: true },
            employeePickup: { enabled: true },
            promotionPolicy: { enabled: true },
            authSecret: process.env.AUTH_SECRET || 'dev-auth-secret-key',
        }),
        shop_plugin_1.ShopPlugin.init({}),
        // 风格模板库与全局配置（四层风格体系后台配置）。app 决定本实例模板库端：nshop/vshop，缺省 nshop
        shop_template_plugin_1.ShopTemplatePlugin.init({ app: process.env.APP ?? 'nshop' }),
        pickup_plugin_1.PickupPlugin.init({}),
        ...((process.env.ALIPAY_NOTIFY_URL || process.env.DEV_BYPASS_ALIPAY === 'true') ? [alipay_plugin_1.AlipayPlugin.init({
                notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
                alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
                auth: process.env.DEV_BYPASS_ALIPAY === 'true' ? {
                    devBypass: true,
                    devBypassOpenid: 'dev_test_openid',
                } : undefined,
            })] : []),
        // 微信支付按租户配置（渠道 payConfig.wechatpay：商户凭证 + 回调地址），故插件无条件加载。
        // 历史实现按 WECHATPAY_NOTIFY_URL 条件加载，导致生产未配该 env 时整个插件缺失：
        // CS-/RC- 结算器注册失败、微信支付入口全部不可用。env 仅保留 devBypass 与 notifyUrl 兜底。
        wechatpay_plugin_1.WechatpayPlugin.init({
            notifyUrl: process.env.WECHATPAY_NOTIFY_URL || '',
            devBypass: process.env.DEV_BYPASS_WECHATPAY === 'true',
            devBypassOpenid: 'dev_test_openid',
        }),
        ...(process.env.OSS_ACCESS_KEY_ID ? [oss_plugin_1.OssPlugin.init({
                region: process.env.OSS_REGION ?? '',
                accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? '',
                accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ?? '',
                bucket: process.env.OSS_BUCKET ?? '',
            })] : []),
        ...((process.env.SMS_ACCESS_KEY_ID || process.env.DEV_BYPASS_SMS === 'true') ? [phone_auth_plugin_1.PhoneAuthPlugin.init({
                accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
                accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET ?? '',
                signName: process.env.SMS_SIGN_NAME ?? '',
                templateCode: process.env.SMS_TEMPLATE_CODE ?? '',
                devBypass: process.env.DEV_BYPASS_SMS === 'true',
                devBypassCode: '123456',
            })] : []),
        ...((process.env.WECHAT_AUTH_APP_ID || process.env.DEV_BYPASS_WECHAT === 'true') ? [wechat_auth_plugin_1.WechatAuthPlugin.init({
                appId: process.env.WECHAT_AUTH_APP_ID || 'dev_test_app_id',
                appSecret: process.env.WECHAT_AUTH_APP_SECRET || 'dev_test_app_secret',
                miniProgramAppId: process.env.WECHAT_AUTH_MINI_APP_ID || '',
                miniProgramAppSecret: process.env.WECHAT_AUTH_MINI_APP_SECRET || '',
                devBypass: process.env.DEV_BYPASS_WECHAT === 'true',
                devBypassOpenid: 'dev_test_openid',
            })] : []),
        ...((process.env.DOUYIN_AUTH_APP_ID || process.env.DEV_BYPASS_DOUYIN === 'true') ? [douyin_auth_plugin_1.DouyinAuthPlugin.init({
                appId: process.env.DOUYIN_AUTH_APP_ID || 'dev_test_app_id',
                appSecret: process.env.DOUYIN_AUTH_APP_SECRET || 'dev_test_app_secret',
                devBypass: process.env.DEV_BYPASS_DOUYIN === 'true',
                devBypassOpenid: 'dev_test_openid',
            })] : []),
        order_timeout_plugin_1.OrderTimeoutPlugin.init({ defaultPaymentTimeoutMinutes: 30 }),
        invoice_plugin_1.InvoicePlugin.init({ provider: new invoice_pdf_plugin_1.PdfInvoiceProvider() }),
        group_buy_plugin_1.GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
        flash_sale_plugin_1.FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
        distribution_plugin_1.DistributionPlugin.init({
            defaultDirectRate: 1000,
            defaultIndirectRate: 500,
            minWithdrawalAmount: 10000,
            settlementDays: 7,
        }),
        eco_plugin_1.EcoPlugin.init(),
        product_survey_plugin_1.ProductSurveyPlugin.init(),
        ...(process.env.REDIS_URL ? [redis_stock_plugin_1.RedisStockPlugin.init({
                redisUrl: process.env.REDIS_URL,
            })] : []),
        ...(process.env.KUAIDI100_CUSTOMER ? [logistics_api_plugin_1.LogisticsApiPlugin.init({
                customer: process.env.KUAIDI100_CUSTOMER,
                key: process.env.KUAIDI100_KEY ?? '',
            })] : []),
        invoice_pdf_plugin_1.InvoicePdfPlugin.init(),
        recharge_card_plugin_1.RechargeCardPlugin.init({ defaultExpiresMonths: 12 }),
        after_sales_plugin_1.AfterSalesPlugin.init(),
        member_level_plugin_1.MemberLevelPlugin.init(),
        // 门店收银 POS：会员价依赖 MemberLevelPlugin；离线同步插件内部复用 VcashPosPlugin（同库/同渠道）
        vcash_pos_plugin_1.VcashPosPlugin,
        vcash_offline_plugin_1.VcashOfflinePlugin,
        checkin_plugin_1.CheckinPlugin.init(),
        review_plugin_1.ReviewPlugin.init(),
        // 商品收藏 / 店铺关注（toggle 语义，依赖 ShopPlugin 的 Shop 实体）
        favorite_plugin_1.FavoritePlugin.init(),
        wechat_subscribe_message_plugin_1.WechatSubscribeMessagePlugin.init(),
        coupon_plugin_1.CouponPlugin.init(),
        live_streaming_plugin_1.LiveStreamingPlugin.init({
            pushDomain: process.env.LIVE_PUSH_DOMAIN || 'rtmp://push.test.com/live/',
            playDomain: process.env.LIVE_PLAY_DOMAIN || 'https://play.test.com/live/',
            liveCommissionRate: Number(process.env.LIVE_COMMISSION_RATE || 1000),
            wsUrl: process.env.LIVE_WS_URL || 'ws://localhost:3003',
            wsSecret: process.env.LIVE_WS_SECRET || 'dev-live-secret',
        }),
        delivery_plugin_1.DeliveryPlugin.init(),
        sales_plugin_1.SalesPlugin.init(),
        marketplace_plugin_1.MarketplacePlugin.init({}),
        // LogisticsPlugin 必须在 MarketplacePlugin 之后注册：两者都会设置 stockLocationStrategy，
        // 最后注册的 MatrixStockLocationStrategy（单一全局矩阵）需覆盖 Marketplace 的组合策略。
        // defaultCompleteDays：自动交易完成默认天数（Delivered 后 N 天），Channel.orderCompleteDays 可覆盖。
        // stockLocationStrategy：绑定感知策略（物理驱动变体只从绑定物理仓分配），覆盖默认 Matrix。
        logistics_plugin_1.LogisticsPlugin.init({
            defaultCompleteDays: 3,
            stockLocationStrategy: new cjk_plugin_1.PhysicalAwareStockLocationStrategy(),
        }),
        // 同城配送抽象网关：Provider 注册表 + Mock 配送商，必须在 LogisticsPlugin 之后注册（Task5）
        delivery_gateway_plugin_1.DeliveryGatewayPlugin.init({
            // 达达凭据：默认占位（dev 骨架），生产用环境变量注入；凭据不落 git。
            // 配置了 DADA_APP_KEY 即注册 DadaProvider；否则回退 mock provider。
            dada: {
                appKey: process.env.DADA_APP_KEY || 'dev-dada-app-key',
                appSecret: process.env.DADA_APP_SECRET || 'dev-dada-app-secret',
                shopNo: process.env.DADA_SHOP_NO || 'dev-dada-shop-no',
                sourceId: process.env.DADA_SOURCE_ID || 'dev-dada-source',
                environment: process.env.DADA_ENV || 'sandbox',
                callbackUrl: process.env.DADA_CALLBACK_URL || 'http://127.0.0.1:3000/delivery-gateway/dada/webhook',
            },
        }),
        customer_service_plugin_1.CustomerServicePlugin.init(),
        inventory_plugin_1.InventoryPlugin.init(),
        operations_plugin_1.OperationsPlugin.init(),
        message_plugin_1.MessagePlugin.init(),
        // 预售/定金预售：两阶段支付（定金→尾款）+ 全款预售 + 分档定价 + 到货释放库存
        pre_sale_plugin_1.PreSalePlugin.init({}),
        // 必须最后注册：覆盖 MarketplacePlugin 的 Seller 拆分，根治租户渠道商品的幽灵配送子单
        DisableSellerSplitPlugin,
    ],
};
// SYNTAX_ERROR_TEST: const x: = ;
function getDbConfig() {
    const dbType = process.env.DB || 'mysql';
    switch (dbType) {
        case 'postgres':
            console.log('Using postgres connection');
            return {
                synchronize: true,
                type: 'postgres',
                host: process.env.DB_HOST || 'localhost',
                port: Number(process.env.DB_PORT) || 5432,
                username: process.env.DB_USERNAME || 'vendure',
                password: process.env.DB_PASSWORD || 'password',
                database: process.env.DB_NAME || 'vendure-dev',
                schema: process.env.DB_SCHEMA || 'public',
            };
        case 'sqlite':
            console.log('Using sqlite connection');
            return {
                synchronize: true,
                type: 'better-sqlite3',
                database: path_1.default.join(devServerDir, 'vendure.sqlite'),
            };
        case 'sqljs':
            console.log('Using sql.js connection');
            return {
                type: 'sqljs',
                autoSave: true,
                database: new Uint8Array([]),
                location: path_1.default.join(devServerDir, 'vendure.sqlite'),
            };
        case 'mysql':
        case 'mariadb':
        default:
            console.log('Using mysql connection');
            return {
                synchronize: true,
                type: 'mariadb',
                host: '127.0.0.1',
                port: 3306,
                username: 'vendure',
                password: 'password',
                database: 'vendure-dev',
            };
    }
}
