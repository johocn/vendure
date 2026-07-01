"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devConfig = void 0;

const core_1 = require("@vendure/core");
const asset_server_plugin_1 = require("@vendure/asset-server-plugin");
const shared_constants_1 = require("@vendure/common/lib/shared-constants");
const email_plugin_1 = require("@vendure/email-plugin");
require("dotenv/config");
const path_1 = require("path");
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

function getDbConfig() {
    const dbType = process.env.DB || 'postgres';
    switch (dbType) {
        case 'postgres':
            return { synchronize: false, type: 'postgres', host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 5432, username: process.env.DB_USERNAME || 'postgres', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'vendure', schema: process.env.DB_SCHEMA || 'public' };
        case 'sqlite':
            return { synchronize: false, type: 'better-sqlite3', database: path_1.join(__dirname, 'vendure.sqlite') };
        default:
            return { synchronize: false, type: 'mariadb', host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306, username: process.env.DB_USERNAME || 'vendure', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'vendure-dev' };
    }
}

exports.devConfig = {
    apiOptions: {
        port: Number(process.env.API_PORT) || 3000,
        adminApiPath: 'admin-api',
        adminApiPlayground: { settings: { 'request.credentials': 'include' } },
        adminApiDebug: false,
        shopApiPath: 'shop-api',
        shopApiPlayground: { settings: { 'request.credentials': 'include' } },
        shopApiDebug: false,
    },
    authOptions: {
        disableAuth: false,
        tokenMethod: ['bearer', 'cookie'],
        requireVerification: false,
        cookieOptions: { secret: process.env.COOKIE_SECRET || 'vendure-prod' },
    },
    dbConnectionOptions: {
        synchronize: false,
        logging: false,
        ...getDbConfig(),
    },
    paymentOptions: {
        paymentMethodHandlers: [core_1.dummyPaymentHandler],
    },
    customFields: {},
    logger: new core_1.DefaultLogger({ level: 2 }),
    plugins: [
        core_1.DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: false }),
        core_1.DefaultJobQueuePlugin.init({}),
        core_1.DefaultSchedulerPlugin.init({}),
        email_plugin_1.EmailPlugin.init({
            devMode: false,
            templatePath: path_1.join(__dirname, '../../email-plugin/templates'),
            handlers: email_plugin_1.defaultEmailHandlers,
            globalTemplateVars: {
                verifyEmailAddressUrl: (process.env.VERIFY_EMAIL_URL) || 'https://example.com/verify',
                passwordResetUrl: (process.env.PASSWORD_RESET_URL) || 'https://example.com/reset-password',
                changeEmailAddressUrl: (process.env.CHANGE_EMAIL_URL) || 'https://example.com/change-email',
            }
        }),
        asset_server_plugin_1.AssetServerPlugin.init({ route: 'assets', assetUploadDir: path_1.join(__dirname, 'assets') }),
        cjk_plugin_1.CjkPlugin.init({ i18n: { enabled: true }, regions: { enabled: true } }),
        order_timeout_plugin_1.OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
        invoice_plugin_1.InvoicePlugin.init(),
        logistics_plugin_1.LogisticsPlugin.init(),
        group_buy_plugin_1.GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
        flash_sale_plugin_1.FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
        distribution_plugin_1.DistributionPlugin.init({ defaultDirectRate: 1000, defaultIndirectRate: 500, minWithdrawalAmount: 10000, settlementDays: 7 }),
        invoice_pdf_plugin_1.InvoicePdfPlugin.init(),
        recharge_card_plugin_1.RechargeCardPlugin.init({ defaultExpiresMonths: 12 }),
        after_sales_plugin_1.AfterSalesPlugin.init(),
        ...(process.env.ALIPAY_NOTIFY_URL ? [alipay_plugin_1.AlipayPlugin.init({ notifyUrl: process.env.ALIPAY_NOTIFY_URL, alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '' })] : []),
        ...(process.env.WECHATPAY_NOTIFY_URL ? [wechatpay_plugin_1.WechatpayPlugin.init({ notifyUrl: process.env.WECHATPAY_NOTIFY_URL })] : []),
        ...(process.env.OSS_ACCESS_KEY_ID ? [oss_plugin_1.OssPlugin.init({ region: process.env.OSS_REGION || '', accessKeyId: process.env.OSS_ACCESS_KEY_ID || '', accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '', bucket: process.env.OSS_BUCKET || '' })] : []),
        ...((process.env.SMS_ACCESS_KEY_ID) ? [phone_auth_plugin_1.PhoneAuthPlugin.init({ accessKeyId: process.env.SMS_ACCESS_KEY_ID || '', accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '', signName: process.env.SMS_SIGN_NAME || '', templateCode: process.env.SMS_TEMPLATE_CODE || '' })] : []),
        ...((process.env.WECHAT_AUTH_APP_ID) ? [wechat_auth_plugin_1.WechatAuthPlugin.init({ appId: process.env.WECHAT_AUTH_APP_ID, appSecret: process.env.WECHAT_AUTH_APP_SECRET || '', miniProgramAppId: process.env.WECHAT_AUTH_MINI_APP_ID || '', miniProgramAppSecret: process.env.WECHAT_AUTH_MINI_APP_SECRET || '' })] : []),
        ...(process.env.REDIS_URL ? [redis_stock_plugin_1.RedisStockPlugin.init({ redisUrl: process.env.REDIS_URL })] : []),
        ...(process.env.KUAIDI100_CUSTOMER ? [logistics_api_plugin_1.LogisticsApiPlugin.init({ customer: process.env.KUAIDI100_CUSTOMER, key: process.env.KUAIDI100_KEY || '' })] : []),
    ],
};
