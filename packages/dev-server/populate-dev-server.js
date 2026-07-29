"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../core/typings.d.ts" />
const core_1 = require("@vendure/core");
const cli_1 = require("@vendure/core/cli");
const testing_1 = require("@vendure/testing");
const path_1 = __importDefault(require("path"));
const initial_data_1 = require("../core/mock-data/data-sources/initial-data");
const dev_config_1 = require("./dev-config");
/* eslint-disable no-console */
/**
 * A CLI script which populates the dev database with deterministic random data.
 */
if (require.main === module) {
    // Running from command line
    const populateConfig = (0, core_1.mergeConfig)(core_1.defaultConfig, (0, core_1.mergeConfig)(dev_config_1.devConfig, {
        authOptions: {
            tokenMethod: 'bearer',
            requireVerification: false,
        },
        importExportOptions: {
            importAssetsDir: path_1.default.join(__dirname, '../core/mock-data/assets'),
        },
        customFields: {},
    }));
    (0, testing_1.clearAllTables)(populateConfig, true)
        .then(() => (0, cli_1.populate)(() => (0, core_1.bootstrap)(populateConfig).then(async (app) => {
        await app.get(core_1.JobQueueService).start();
        return app;
    }), initial_data_1.initialData, path_1.default.join(__dirname, '../create/assets/products.csv')))
        .then(async (app) => {
        console.log('populating customers...');
        await (0, testing_1.populateCustomers)(app, 10, message => core_1.Logger.error(message));
        return app.close();
    })
        .then(() => process.exit(0), err => {
        console.log(err);
        process.exit(1);
    });
}
//# sourceMappingURL=populate-dev-server.js.map