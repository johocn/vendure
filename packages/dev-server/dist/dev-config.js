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
var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
const alipay_plugin_1 = require("@vendure/alipay-plugin");
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
const oss_plugin_1 = require("@vendure/oss-plugin");
const phone_auth_plugin_1 = require("@vendure/phone-auth-plugin");
const wechat_auth_plugin_1 = require("@vendure/wechat-auth-plugin");
const order_timeout_plugin_1 = require("@vendure/order-timeout-plugin");
const invoice_plugin_1 = require("@vendure/invoice-plugin");
const logistics_plugin_1 = require("@vendure/logistics-plugin");
const group_buy_plugin_1 = require("@vendure/group-buy-plugin");
const flash_sale_plugin_1 = require("@vendure/flash-sale-plugin");
const distribution_plugin_1 = require("@vendure/distribution-plugin");
const redis_stock_plugin_1 = require("@vendure/redis-stock-plugin");
const logistics_api_plugin_1 = require("@vendure/logistics-api-plugin");
const invoice_pdf_plugin_1 = require("@vendure/invoice-pdf-plugin");
const recharge_card_plugin_1 = require("@vendure/recharge-card-plugin");
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const nav_modifier_plugin_1 = require("./test-plugins/nav-modifier-plugin/nav-modifier-plugin");
const reviews_plugin_1 = require("./test-plugins/reviews/reviews-plugin");
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
            config.settingsStoreFields = Object.assign(Object.assign({}, config.settingsStoreFields), { ReadonlyTest: [
                    { name: 'buildVersion', readonly: true },
                    { name: 'buildMeta', readonly: true },
                ] });
            return config;
        },
    }),
    __metadata("design:paramtypes", [core_1.SettingsStoreService,
        core_1.RequestContextService])
], ReadonlySettingsTestPlugin);
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
    dbConnectionOptions: Object.assign({ synchronize: false, logging: false, migrations: [path_1.default.join(__dirname, 'migrations/*.ts')] }, getDbConfig()),
    paymentOptions: {
        paymentMethodHandlers: [core_1.dummyPaymentHandler],
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
    customFields: {},
    logger: new core_1.DefaultLogger({ level: core_1.LogLevel.Verbose }),
    importExportOptions: {
        importAssetsDir: path_1.default.join(__dirname, 'import-assets'),
    },
    plugins: [
        ReadonlySettingsTestPlugin,
        reviews_plugin_1.ReviewsPlugin,
        nav_modifier_plugin_1.NavModifierPlugin,
        graphiql_plugin_1.GraphiqlPlugin.init(),
        asset_server_plugin_1.AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path_1.default.join(__dirname, 'assets'),
        }),
        core_1.DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: false }),
        core_1.DefaultJobQueuePlugin.init({}),
        core_1.DefaultSchedulerPlugin.init({}),
        email_plugin_1.EmailPlugin.init({
            devMode: true,
            route: 'mailbox',
            handlers: email_plugin_1.defaultEmailHandlers,
            templateLoader: new email_plugin_1.FileBasedTemplateLoader(path_1.default.join(__dirname, '../email-plugin/templates')),
            outputPath: path_1.default.join(__dirname, 'test-emails'),
            globalTemplateVars: {
                verifyEmailAddressUrl: 'http://localhost:4201/verify',
                passwordResetUrl: 'http://localhost:4201/reset-password',
                changeEmailAddressUrl: 'http://localhost:4201/change-email-address',
            },
        }),
        ...(IS_INSTRUMENTED ? [telemetry_plugin_1.TelemetryPlugin.init({})] : []),
        admin_ui_plugin_1.AdminUiPlugin.init({
            route: 'admin',
            port: 5001,
            adminUiConfig: {},
        }),
        plugin_1.DashboardPlugin.init({
            route: 'dashboard',
            appDir: path_1.default.join(__dirname, './dist'),
        }),
        cjk_plugin_1.CjkPlugin.init({ i18n: { enabled: true }, regions: { enabled: true } }),
        ...(process.env.ALIPAY_NOTIFY_URL ? [alipay_plugin_1.AlipayPlugin.init({
                notifyUrl: process.env.ALIPAY_NOTIFY_URL,
                alipayPublicKey: (_a = process.env.ALIPAY_PUBLIC_KEY) !== null && _a !== void 0 ? _a : '',
            })] : []),
        ...(process.env.WECHATPAY_NOTIFY_URL ? [wechatpay_plugin_1.WechatpayPlugin.init({
                notifyUrl: process.env.WECHATPAY_NOTIFY_URL,
            })] : []),
        ...(process.env.OSS_ACCESS_KEY_ID ? [oss_plugin_1.OssPlugin.init({
                region: (_b = process.env.OSS_REGION) !== null && _b !== void 0 ? _b : '',
                accessKeyId: (_c = process.env.OSS_ACCESS_KEY_ID) !== null && _c !== void 0 ? _c : '',
                accessKeySecret: (_d = process.env.OSS_ACCESS_KEY_SECRET) !== null && _d !== void 0 ? _d : '',
                bucket: (_e = process.env.OSS_BUCKET) !== null && _e !== void 0 ? _e : '',
            })] : []),
        ...((process.env.SMS_ACCESS_KEY_ID || process.env.DEV_BYPASS_SMS === 'true') ? [phone_auth_plugin_1.PhoneAuthPlugin.init({
                accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
                accessKeySecret: (_f = process.env.SMS_ACCESS_KEY_SECRET) !== null && _f !== void 0 ? _f : '',
                signName: (_g = process.env.SMS_SIGN_NAME) !== null && _g !== void 0 ? _g : '',
                templateCode: (_h = process.env.SMS_TEMPLATE_CODE) !== null && _h !== void 0 ? _h : '',
                devBypass: process.env.DEV_BYPASS_SMS === 'true',
                devBypassCode: '123456',
            })] : []),
        ...((process.env.WECHAT_AUTH_APP_ID || process.env.DEV_BYPASS_WECHAT === 'true') ? [wechat_auth_plugin_1.WechatAuthPlugin.init({
                appId: process.env.WECHAT_AUTH_APP_ID || 'dev_test_app_id',
                appSecret: process.env.WECHAT_AUTH_APP_SECRET || 'dev_test_app_secret',
                miniProgramAppId: process.env.WECHAT_AUTH_MINI_APP_ID || '',
                miniProgramAppSecret: process.env.WECHAT_AUTH_MINI_APP_SECRET || '',
            })] : []),
        order_timeout_plugin_1.OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
        invoice_plugin_1.InvoicePlugin.init(),
        logistics_plugin_1.LogisticsPlugin.init(),
        group_buy_plugin_1.GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
        flash_sale_plugin_1.FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
        distribution_plugin_1.DistributionPlugin.init({
            defaultDirectRate: 1000,
            defaultIndirectRate: 500,
            minWithdrawalAmount: 10000,
            settlementDays: 7,
        }),
        ...(process.env.REDIS_URL ? [redis_stock_plugin_1.RedisStockPlugin.init({
                redisUrl: process.env.REDIS_URL,
            })] : []),
        ...(process.env.KUAIDI100_CUSTOMER ? [logistics_api_plugin_1.LogisticsApiPlugin.init({
                customer: process.env.KUAIDI100_CUSTOMER,
                key: (_j = process.env.KUAIDI100_KEY) !== null && _j !== void 0 ? _j : '',
            })] : []),
        invoice_pdf_plugin_1.InvoicePdfPlugin.init(),
        recharge_card_plugin_1.RechargeCardPlugin.init({ defaultExpiresMonths: 12 }),
        after_sales_plugin_1.AfterSalesPlugin.init(),
    ],
};
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
                database: path_1.default.join(__dirname, 'vendure.sqlite'),
            };
        case 'sqljs':
            console.log('Using sql.js connection');
            return {
                type: 'sqljs',
                autoSave: true,
                database: new Uint8Array([]),
                location: path_1.default.join(__dirname, 'vendure.sqlite'),
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
