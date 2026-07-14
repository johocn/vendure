/* eslint-disable no-console */
import { OnApplicationBootstrap } from '@nestjs/common';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { ADMIN_API_PATH, API_PORT, SHOP_API_PATH } from '@vendure/common/lib/shared-constants';
import {
    cleanOrphanedSettingsStoreTask,
    cleanSessionsTask,
    DefaultJobQueuePlugin,
    DefaultLogger,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    dummyPaymentHandler,
    LogLevel,
    PluginCommonModule,
    RequestContextService,
    SettingsStoreScopes,
    SettingsStoreService,
    VendureConfig,
    VendurePlugin,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import { TelemetryPlugin } from '@vendure/telemetry-plugin';
import 'dotenv/config';
import path from 'path';
import { DataSourceOptions } from 'typeorm';
import { CjkPlugin } from '@vendure/cjk-plugin';
import { AlipayPlugin } from '@vendure/alipay-plugin';
import { WechatpayPlugin } from '@vendure/wechatpay-plugin';
import { OssPlugin } from '@vendure/oss-plugin';
import { PhoneAuthPlugin } from '@vendure/phone-auth-plugin';
import { WechatAuthPlugin } from '@vendure/wechat-auth-plugin';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';
import { InvoicePlugin } from '@vendure/invoice-plugin';
import { LogisticsPlugin } from '@vendure/logistics-plugin';
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';
import { DistributionPlugin } from '@vendure/distribution-plugin';
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';
import { LogisticsApiPlugin } from '@vendure/logistics-api-plugin';
import { InvoicePdfPlugin } from '@vendure/invoice-pdf-plugin';
import { RechargeCardPlugin } from '@vendure/recharge-card-plugin';
import { AfterSalesPlugin } from '@vendure/after-sales-plugin';
import { NavModifierPlugin } from './test-plugins/nav-modifier-plugin/nav-modifier-plugin';
// import { FieldTestPlugin } from './test-plugins/field-test/field-test-plugin';
import { ReviewsPlugin } from './test-plugins/reviews/reviews-plugin';
import { FloorBuilderPlugin } from './test-plugins/floor-builder';

const IS_INSTRUMENTED = process.env.IS_INSTRUMENTED === 'true';

@VendurePlugin({
    imports: [PluginCommonModule],
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
})
class ReadonlySettingsTestPlugin implements OnApplicationBootstrap {
    constructor(
        private settingsStoreService: SettingsStoreService,
        private requestContextService: RequestContextService,
    ) {}
    async onApplicationBootstrap() {
        const ctx = await this.requestContextService.create({ apiType: 'admin' });
        await this.settingsStoreService.set(ctx, 'ReadonlyTest.buildVersion', 'v3.5.2' as any);
        await this.settingsStoreService.set(ctx, 'ReadonlyTest.buildMeta', {
            buildDate: '2026-03-06',
            commit: 'd0384f3ed',
            features: ['settings-store-ui', 'option-groups'],
        });
    }
}

/**
 * Config settings used during development
 */
export const devConfig: VendureConfig = {
    apiOptions: {
        port: Number(process.env.API_PORT) || API_PORT,
        adminApiPath: ADMIN_API_PATH,
        adminApiPlayground: {
            settings: {
                'request.credentials': 'include',
            },
        },
        adminApiDebug: true,
        shopApiPath: SHOP_API_PATH,
        shopApiPlayground: {
            settings: {
                'request.credentials': 'include',
            },
        },
        shopApiDebug: true,
    },
    authOptions: {
        disableAuth: false,
        tokenMethod: ['bearer', 'cookie', 'api-key'] as const,
        requireVerification: false,
        customPermissions: [],
        cookieOptions: {
            secret: 'abc',
        },
    },
    dbConnectionOptions: {
        synchronize: false,
        logging: false,
        migrations: [path.join(__dirname, 'migrations/*.ts')],
        ...getDbConfig(),
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    settingsStoreFields: {
        MyPlugin: [
            {
                name: 'globalVal',
            },
            {
                name: 'userVal',
                scope: SettingsStoreScopes.user,
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
                    { name: 'primaryColor', type: 'string', defaultValue: '#ff6600' },
                    { name: 'backgroundColor', type: 'string', defaultValue: '#ffffff' },
                    { name: 'titleIcon', type: 'string' },
                ],
            },
            {
                name: 'floorItemConfig', type: 'struct', list: true, public: true, fields: [
                    { name: 'productId', type: 'string' },
                    { name: 'size', type: 'string', defaultValue: 'medium',
                      ui: { component: 'select-form-input',
                            options: [
                                { value: 'small', label: '小' },
                                { value: 'medium', label: '中' },
                                { value: 'large', label: '大' },
                            ] } },
                    { name: 'highlighted', type: 'boolean', defaultValue: false },
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
        Channel: [],
        Customer: [],
        Fulfillment: [],
        Order: [],
        Product: [],
        Promotion: [],
    },
    schedulerOptions: {
        tasks: [cleanSessionsTask, cleanOrphanedSettingsStoreTask],
    },
    logger: new DefaultLogger({ level: LogLevel.Verbose }),
    importExportOptions: {
        importAssetsDir: path.join(__dirname, 'import-assets'),
    },
    plugins: [
        // MultivendorPlugin.init({
        //     platformFeePercent: 10,
        //     platformFeeSKU: 'FEE',
        // }),
        ReadonlySettingsTestPlugin,
        ReviewsPlugin,
        FloorBuilderPlugin,
        // FieldTestPlugin,
        NavModifierPlugin,
        GraphiqlPlugin.init(),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, 'assets'),
        }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: false }),
        // Enable if you need to debug the job queue
        // BullMQJobQueuePlugin.init({}),
        DefaultJobQueuePlugin.init({}),
        // JobQueueTestPlugin.init({ queueCount: 10 }),
        DefaultSchedulerPlugin.init({}),
        EmailPlugin.init({
            devMode: true,
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../email-plugin/templates')),
            outputPath: path.join(__dirname, 'test-emails'),
            globalTemplateVars: {
                verifyEmailAddressUrl: 'http://localhost:4201/verify',
                passwordResetUrl: 'http://localhost:4201/reset-password',
                changeEmailAddressUrl: 'http://localhost:4201/change-email-address',
            },
        }),
        ...(IS_INSTRUMENTED ? [TelemetryPlugin.init({})] : []),
        // AdminUiPlugin requires pre-built admin-ui bundle. Build with:
        // cd packages/admin-ui && npm run build:app
        AdminUiPlugin.init({
            route: 'admin',
            port: 5001,
            adminUiConfig: {},
        }),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: path.join(__dirname, './dist'),
        }),
        CjkPlugin.init({
            i18n: { enabled: true },
            regions: { enabled: true },
            tenant: { enabled: true },
            cod: { enabled: true },
            storePickup: { enabled: true },
            pickupPoint: { enabled: true },
            promotionPolicy: { enabled: true },
        }),
        ...(process.env.ALIPAY_NOTIFY_URL ? [AlipayPlugin.init({
            notifyUrl: process.env.ALIPAY_NOTIFY_URL,
            alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
        })] : []),
        ...(process.env.WECHATPAY_NOTIFY_URL ? [WechatpayPlugin.init({
            notifyUrl: process.env.WECHATPAY_NOTIFY_URL,
        })] : []),
        ...(process.env.OSS_ACCESS_KEY_ID ? [OssPlugin.init({
            region: process.env.OSS_REGION ?? '',
            accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? '',
            accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ?? '',
            bucket: process.env.OSS_BUCKET ?? '',
        })] : []),
        ...((process.env.SMS_ACCESS_KEY_ID || process.env.DEV_BYPASS_SMS === 'true') ? [PhoneAuthPlugin.init({
            accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
            accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET ?? '',
            signName: process.env.SMS_SIGN_NAME ?? '',
            templateCode: process.env.SMS_TEMPLATE_CODE ?? '',
            devBypass: process.env.DEV_BYPASS_SMS === 'true',
            devBypassCode: '123456',
        })] : []),
        ...((process.env.WECHAT_AUTH_APP_ID || process.env.DEV_BYPASS_WECHAT === 'true') ? [WechatAuthPlugin.init({
            appId: process.env.WECHAT_AUTH_APP_ID || 'dev_test_app_id',
            appSecret: process.env.WECHAT_AUTH_APP_SECRET || 'dev_test_app_secret',
            miniProgramAppId: process.env.WECHAT_AUTH_MINI_APP_ID || '',
            miniProgramAppSecret: process.env.WECHAT_AUTH_MINI_APP_SECRET || '',
        })] : []),
        OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
        InvoicePlugin.init(),
        LogisticsPlugin.init(),
        GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
        FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
        DistributionPlugin.init({
            defaultDirectRate: 1000,
            defaultIndirectRate: 500,
            minWithdrawalAmount: 10000,
            settlementDays: 7,
        }),
        ...(process.env.REDIS_URL ? [RedisStockPlugin.init({
            redisUrl: process.env.REDIS_URL,
        })] : []),
        ...(process.env.KUAIDI100_CUSTOMER ? [LogisticsApiPlugin.init({
            customer: process.env.KUAIDI100_CUSTOMER,
            key: process.env.KUAIDI100_KEY ?? '',
        })] : []),
        InvoicePdfPlugin.init(),
        RechargeCardPlugin.init({ defaultExpiresMonths: 12 }),
        AfterSalesPlugin.init(),
    ],
};

function getDbConfig(): DataSourceOptions {
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
                database: path.join(__dirname, 'vendure.sqlite'),
            };
        case 'sqljs':
            console.log('Using sql.js connection');
            return {
                type: 'sqljs',
                autoSave: true,
                database: new Uint8Array([]),
                location: path.join(__dirname, 'vendure.sqlite'),
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
