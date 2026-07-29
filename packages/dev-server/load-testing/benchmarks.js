"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const populate_1 = require("@vendure/core/cli/populate");
const testing_1 = require("@vendure/testing");
const child_process_1 = require("child_process");
const commander_1 = __importDefault(require("commander"));
const path_1 = __importDefault(require("path"));
const progress_1 = __importDefault(require("progress"));
const load_test_config_1 = require("./load-test-config");
/**
 * This set of benchmarks aims to specifically test the performance issues discussed
 * in issue https://github.com/vendurehq/vendure/issues/1506.
 *
 * In order to test these issues, we need a test dataset that will create:
 *
 * 1. 1k Products, each with 10 ProductVariants
 * 2. 10k Orders, each with 10 OrderLines, each OrderLine with qty 5
 *
 * Then we will test:
 *
 * 1. Fetching 10 Products from the `products` query. This will test the effects of indexes, ListQueryBuilder & dataloader
 * 2. As above but with Orders
 * 3. Fetching a list of orders and selecting only the Order id.
 *    This will test optimization of selecting & joining only the needed fields.
 */
const DATABASE_NAME = 'vendure-benchmarks';
const PRODUCT_COUNT = 1000;
const VARIANTS_PER_PRODUCT = 10;
const ORDER_COUNT = 10000;
const LINES_PER_ORDER = 10;
const QUANTITY_PER_ORDER_LINE = 5;
commander_1.default
    .option('--script <script>', 'Specify the k6 script to run')
    .option('--db <db>', 'Select which database to test against', /^(mysql|postgres)$/, 'mysql')
    .option('--populate', 'Whether to populate the database')
    .option('--variant <variant>', 'Which variant of the given script')
    .parse(process.argv);
const opts = commander_1.default.opts();
runBenchmark(opts).then(() => process.exit(0));
async function runBenchmark(options) {
    const config = (0, load_test_config_1.getLoadTestConfig)('bearer', DATABASE_NAME, options.db);
    if (options.populate) {
        console.log(`Populating benchmark database "${DATABASE_NAME}"`);
        await (0, testing_1.clearAllTables)(config, true);
        const populateApp = await (0, populate_1.populate)(() => (0, core_1.bootstrap)(config), path_1.default.join(__dirname, '../../create/assets/initial-data.json'));
        await createProducts(populateApp);
        await createOrders(populateApp);
        await populateApp.close();
    }
    else {
        const app = await (0, core_1.bootstrap)(config);
        await new Promise((resolve, reject) => {
            const runArgs = ['run', `./scripts/${options.script}`];
            if (options.variant) {
                console.log(`Using variant "${options.variant}"`);
                runArgs.push('-e', `variant=${options.variant}`);
            }
            const loadTest = (0, child_process_1.spawn)('k6', runArgs, {
                cwd: __dirname,
                stdio: 'inherit',
            });
            loadTest.on('exit', code => {
                if (code === 0) {
                    resolve(code);
                }
                else {
                    reject();
                }
            });
            loadTest.on('error', err => {
                reject(err);
            });
        });
        await app.close();
    }
}
async function createProducts(app) {
    const importer = app.get(core_1.Importer);
    const ctx = await app.get(core_1.RequestContextService).create({
        apiType: 'admin',
    });
    const bar = new progress_1.default('creating products [:bar] (:current/:total) :percent :etas', {
        complete: '=',
        incomplete: ' ',
        total: PRODUCT_COUNT,
        width: 40,
    });
    const products = [];
    for (let i = 0; i < PRODUCT_COUNT; i++) {
        const product = {
            product: {
                optionGroups: [
                    {
                        translations: [
                            {
                                languageCode: core_1.LanguageCode.en,
                                name: `prod-${i}-option`,
                                values: Array.from({ length: VARIANTS_PER_PRODUCT }).map((_, opt) => `prod-${i}-option-${opt}`),
                            },
                        ],
                    },
                ],
                translations: [
                    {
                        languageCode: core_1.LanguageCode.en,
                        name: `Product ${i}`,
                        slug: `product-${i}`,
                        description: '',
                        customFields: {},
                    },
                ],
                assetPaths: [],
                facets: [],
            },
            variants: Array.from({ length: VARIANTS_PER_PRODUCT }).map((value, index) => ({
                sku: `PROD-${i}-${index}`,
                facets: [],
                assetPaths: [],
                price: 1000,
                stockOnHand: 100,
                taxCategory: 'standard',
                trackInventory: generated_types_1.GlobalFlag.INHERIT,
                translations: [
                    {
                        languageCode: core_1.LanguageCode.en,
                        optionValues: [`prod-${i}-option-${index}`],
                        customFields: {},
                    },
                ],
            })),
        };
        products.push(product);
    }
    await importer.importProducts(ctx, products, progess => bar.tick());
}
async function createOrders(app) {
    const orderService = app.get(core_1.OrderService);
    const bar = new progress_1.default('creating orders [:bar] (:current/:total) :percent :etas', {
        complete: '=',
        incomplete: ' ',
        total: ORDER_COUNT,
        width: 40,
    });
    for (let i = 0; i < ORDER_COUNT; i++) {
        const ctx = await app.get(core_1.RequestContextService).create({
            apiType: 'shop',
        });
        const order = await orderService.create(ctx);
        const variantId = (i % (PRODUCT_COUNT * VARIANTS_PER_PRODUCT)) + 1;
        const result = await orderService.addItemToOrder(ctx, order.id, variantId, QUANTITY_PER_ORDER_LINE);
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            console.log(result);
        }
        bar.tick();
    }
}
//# sourceMappingURL=benchmarks.js.map