"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../core/typings.d.ts" />
const core_1 = require("@vendure/core");
const populate_1 = require("@vendure/core/cli/populate");
const testing_1 = require("@vendure/testing");
const csv_stringify_1 = require("csv-stringify");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const initial_data_1 = require("../../core/mock-data/data-sources/initial-data");
const load_test_config_1 = require("./load-test-config");
const await_running_jobs_1 = require("../../core/e2e/utils/await-running-jobs");
/* eslint-disable no-console */
/**
 * A script used to populate a database with test data for load testing.
 */
if (require.main === module) {
    // Running from command line
    const count = (0, load_test_config_1.getProductCount)();
    const databaseName = `vendure-load-testing-${count}`;
    isDatabasePopulated(databaseName)
        .then(isPopulated => {
        console.log('isPopulated:', isPopulated);
        if (!isPopulated) {
            const config = (0, load_test_config_1.getLoadTestConfig)('bearer', databaseName);
            const csvFile = (0, load_test_config_1.getProductCsvFilePath)();
            return (0, testing_1.clearAllTables)(config, true)
                .then(() => {
                if (!fs_1.default.existsSync(csvFile)) {
                    return generateProductsCsv(count);
                }
            })
                .then(() => (0, populate_1.populate)(() => (0, core_1.bootstrap)(config).then(async (app) => {
                await app.get(core_1.JobQueueService).start();
                return app;
            }), path_1.default.join(__dirname, '../../create/assets/initial-data.json'), csvFile))
                .then(async (app) => {
                console.log('synchronize on search index updated...');
                const { port, adminApiPath, shopApiPath } = config.apiOptions;
                const adminClient = new testing_1.SimpleGraphQLClient(config, `http://localhost:${port}/${adminApiPath}`);
                await adminClient.asSuperAdmin();
                await new Promise(resolve => setTimeout(resolve, 5000));
                await (0, await_running_jobs_1.awaitRunningJobs)(adminClient, 5000000);
                return app;
            })
                .then(async (app) => {
                console.log('populating customers...');
                await (0, testing_1.populateCustomers)(app, 10, message => core_1.Logger.error(message));
                return app.close();
            });
        }
        else {
            console.log('Database is already populated!');
        }
    })
        .then(() => process.exit(0), err => {
        console.log(err);
        process.exit(1);
    });
}
/**
 * Tests to see whether the load test database is already populated.
 */
async function isDatabasePopulated(databaseName) {
    var _a;
    const isPostgres = process.env.DB === 'postgres';
    if (isPostgres) {
        console.log('Checking whether data is populated (postgres)');
        const pg = require('pg');
        const postgresConnectionOptions = (0, load_test_config_1.getPostgresConnectionOptions)(databaseName);
        const client = new pg.Client({
            host: postgresConnectionOptions.host,
            user: postgresConnectionOptions.username,
            database: postgresConnectionOptions.database,
            password: postgresConnectionOptions.password,
            port: postgresConnectionOptions.port,
        });
        await client.connect();
        try {
            const res = await client.query('SELECT COUNT(id) as prodCount FROM product');
            if (((_a = res.rows[0]) === null || _a === void 0 ? void 0 : _a.prodcount) < 1) {
                return false;
            }
            return true;
        }
        catch (e) {
            if (e.message === 'relation "product" does not exist') {
                return false;
            }
            throw e;
        }
    }
    else {
        const mysql = require('mysql2/promise');
        const mysqlConnectionOptions = (0, load_test_config_1.getMysqlConnectionOptions)(databaseName);
        const connection = mysql.createConnection({
            host: mysqlConnectionOptions.host,
            user: mysqlConnectionOptions.username,
            password: mysqlConnectionOptions.password,
            database: mysqlConnectionOptions.database,
        });
        return new Promise((resolve, reject) => {
            connection.connect((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                connection.query('SELECT COUNT(id) as prodCount FROM product', (err, results) => {
                    if (err) {
                        if (err.code === 'ER_NO_SUCH_TABLE') {
                            resolve(false);
                            return;
                        }
                        reject(err);
                        return;
                    }
                    resolve(true);
                });
            });
        });
    }
}
/**
 * Generates a CSV file of test product data which can then be imported into Vendure.
 */
function generateProductsCsv(productCount = 100) {
    const result = [];
    const stringifier = (0, csv_stringify_1.stringify)({
        delimiter: ',',
    });
    const data = [];
    console.log(`Generating ${productCount} rows of test product data...`);
    stringifier.on('readable', () => {
        let row;
        // eslint-disable-next-line no-cond-assign
        while ((row = stringifier.read())) {
            data.push(row);
        }
    });
    return new Promise((resolve, reject) => {
        const csvFile = (0, load_test_config_1.getProductCsvFilePath)();
        stringifier.on('error', (err) => {
            reject(err.message);
        });
        stringifier.on('finish', async () => {
            fs_1.default.writeFileSync(csvFile, data.join(''));
            console.log(`Done! Saved to ${csvFile}`);
            resolve();
        });
        generateMockData(productCount, row => stringifier.write(row));
        stringifier.end();
    });
}
function generateMockData(productCount, writeFn) {
    const headers = [
        'name',
        'slug',
        'description',
        'assets',
        'facets',
        'optionGroups',
        'optionValues',
        'sku',
        'price',
        'taxCategory',
        'variantAssets',
        'variantFacets',
        'stockOnHand',
        'trackInventory',
    ];
    writeFn(headers);
    const categories = getCategoryNames();
    for (let i = 1; i <= productCount; i++) {
        const outputRow = {
            name: `Product ${i}`,
            slug: `product-${i}`,
            description: generateProductDescription(),
            assets: 'product-image.jpg',
            facets: `category:${categories[i % categories.length]}`,
            optionGroups: '',
            optionValues: '',
            sku: `PRODID${i}`,
            price: (Math.random() * 1000).toFixed(2),
            taxCategory: 'standard',
            variantAssets: '',
            variantFacets: '',
            stockOnHand: '1000',
            trackInventory: 'false',
        };
        writeFn(Object.values(outputRow));
    }
}
function getCategoryNames() {
    const allNames = new Set();
    for (const collection of initial_data_1.initialData.collections) {
        for (const filter of collection.filters || []) {
            filter.args.facetValueNames.forEach(name => allNames.add(name));
        }
    }
    return Array.from(new Set(allNames));
}
const parts = [
    'Now equipped with seventh-generation Intel Core processors',
    'Laptop is snappier than ever',
    'From daily tasks like launching apps and opening files to more advanced computing',
    'You can power through your day thanks to faster SSDs and Turbo Boost processing up to 3.6GHz',
    'Discover a truly immersive viewing experience with this monitor curved more deeply than any other',
    'Wrapping around your field of vision the 1,800 R screencreates a wider field of view',
    'This pc is optimised for gaming, and is also VR ready',
    'The Intel Core-i7 CPU and High Performance GPU give the computer the raw power it needs to function at a high level',
    'Boost your PC storage with this internal hard drive, designed just for desktop and all-in-one PCs',
    'Let all your colleagues know that you are typing on this exclusive, colorful klicky-klacky keyboard',
    'Solid conductors eliminate strand-interaction distortion and reduce jitter',
    'As the surface is made of high-purity silver',
    'the performance is very close to that of a solid silver cable',
    'but priced much closer to solid copper cable',
    'With its nostalgic design and simple point-and-shoot functionality',
    'the Instant Camera is the perfect pick to get started with instant photography',
    'This lens is a Di type lens using an optical system with improved multi-coating designed to function with digital SLR cameras as well as film cameras',
    'Capture vivid, professional-style photographs with help from this lightweight tripod',
    'The adjustable-height tripod makes it easy to achieve reliable stability',
    'Just the right angle when going after that award-winning shot',
    'Featuring a full carbon chassis - complete with cyclocross-specific carbon fork',
    "It's got the low weight, exceptional efficiency and brilliant handling",
    "You'll need to stay at the front of the pack",
    "When you're working out you need a quality rope that doesn't tangle at every couple of jumps",
    'Training gloves designed for optimum training',
    'Our gloves promote proper punching technique because they are conformed to the natural shape of your fist',
    'Dense, innovative two-layer foam provides better shock absorbency',
    'Full padding on the front, back and wrist to promote proper punching technique',
    'With tons of space inside (for max. 4 persons), full head height throughout',
    'This tent offers you everything you need',
    'Based on the 1970s iconic shape, but made to a larger 69cm size',
    'These skateboards are great for beginners to learn the foot spacing required',
    'Perfect for all-day cruising',
    'This football features high-contrast graphics for high-visibility during play',
    'Its machine-stitched tpu casing offers consistent performance',
    'With its ultra-light, uber-responsive magic foam',
    'The Running Shoe is ready to push you to victories both large and small',
    'A spiky yet elegant house cactus',
    'Perfect for the home or office',
    'Origin and habitat: Probably native only to the Andes of Peru',
    'Gloriously elegant',
    'It can go along with any interior as it is a neutral color and the most popular Phalaenopsis overall',
    '2 to 3 foot stems host large white flowers that can last for over 2 months',
    'Excellent semi-evergreen bonsai',
    'Indoors or out but needs some winter protection',
    'All trees sent will leave the nursery in excellent condition and will be of equal quality or better than the photograph shown',
    'Placing it at home or office can bring you fortune and prosperity',
    'Guards your house and ward off ill fortune',
    'Hand trowel for garden cultivating hammer finish epoxy-coated head',
    'For improved resistance to rust, scratches, humidity and alkalines in the soil',
    'A charming vintage white wooden chair',
    'Featuring an extremely spherical pink balloon',
    'The balloon may be detached and used for other purposes',
    "This premium, tan-brown bonded leather seat is part of the 'chill' sofa range",
    'The lever activated recline feature makes it easy to adjust to any position',
    'This smart, bustle back design with rounded tight padded arms has been designed with your comfort in mind',
    'This well-padded chair has foam pocket sprung seat cushions and fibre-filled back cushions',
    'Modern tapered white polycotton pendant shade with a metallic silver chrome interior',
    'For maximum light reflection',
    'Reversible gimble so it can be used as a ceiling shade or as a lamp shade',
];
function generateProductDescription() {
    const take = Math.ceil(Math.random() * 4);
    return shuffle(parts).slice(0, take).join('. ');
}
/**
 * Returns new copy of array in random order.
 * https://stackoverflow.com/a/6274381/772859
 */
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
//# sourceMappingURL=init-load-test.js.map