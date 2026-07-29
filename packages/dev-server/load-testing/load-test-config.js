"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMysqlConnectionOptions = getMysqlConnectionOptions;
exports.getPostgresConnectionOptions = getPostgresConnectionOptions;
exports.getLoadTestConfig = getLoadTestConfig;
exports.getProductCsvFilePath = getProductCsvFilePath;
exports.getProductCount = getProductCount;
exports.getScriptToRun = getScriptToRun;
/* eslint-disable no-console */
const asset_server_plugin_1 = require("@vendure/asset-server-plugin");
const core_1 = require("@vendure/core");
const path_1 = __importDefault(require("path"));
function getMysqlConnectionOptions(databaseName) {
    return {
        type: 'mysql',
        host: '127.0.0.1',
        port: 3306,
        username: 'root',
        password: '',
        database: databaseName,
        extra: {
        // connectionLimit: 150,
        },
    };
}
function getPostgresConnectionOptions(databaseName) {
    return {
        type: 'postgres',
        host: '127.0.0.1',
        port: 5432,
        username: 'admin',
        password: 'secret',
        database: databaseName,
    };
}
function getLoadTestConfig(tokenMethod, databaseName, db) {
    const connectionOptions = process.env.DB === 'postgres' || db === 'postgres'
        ? getPostgresConnectionOptions(databaseName)
        : getMysqlConnectionOptions(databaseName);
    return (0, core_1.mergeConfig)(core_1.defaultConfig, {
        paymentOptions: {
            paymentMethodHandlers: [core_1.dummyPaymentHandler],
        },
        orderOptions: {
            orderItemsLimit: 99999,
        },
        logger: new core_1.DefaultLogger({ level: core_1.LogLevel.Info }),
        dbConnectionOptions: Object.assign(Object.assign({}, connectionOptions), { synchronize: true }),
        authOptions: {
            tokenMethod,
            requireVerification: false,
            sessionCacheStrategy: new core_1.InMemorySessionCacheStrategy(),
        },
        importExportOptions: {
            importAssetsDir: path_1.default.join(__dirname, './data-sources'),
        },
        customFields: {},
        plugins: [
            asset_server_plugin_1.AssetServerPlugin.init({
                assetUploadDir: path_1.default.join(__dirname, 'static/assets'),
                route: 'assets',
            }),
            core_1.DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: false }),
            core_1.DefaultJobQueuePlugin.init({
                pollInterval: 1000,
            }),
        ],
    });
}
function getProductCsvFilePath() {
    const count = getProductCount();
    return path_1.default.join(__dirname, `./data-sources/products-${count}.csv`);
}
function getProductCount() {
    const count = +process.argv[2];
    if (!count) {
        console.error('Please specify the number of products to generate');
        process.exit(1);
    }
    return count;
}
function getScriptToRun() {
    const script = process.argv[3];
    if (script) {
        return [script];
    }
}
//# sourceMappingURL=load-test-config.js.map