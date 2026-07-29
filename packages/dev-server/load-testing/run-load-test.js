"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/core");
const child_process_1 = require("child_process");
const csv_stringify_1 = require("csv-stringify");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const omit_1 = require("../../common/src/omit");
const generate_summary_1 = require("./generate-summary");
const load_test_config_1 = require("./load-test-config");
const count = (0, load_test_config_1.getProductCount)();
if (require.main === module) {
    const ALL_SCRIPTS = ['deep-query.js', 'search-and-checkout.js', 'very-large-order.js'];
    const scriptsToRun = (0, load_test_config_1.getScriptToRun)() || ALL_SCRIPTS;
    console.log(`\n============= Vendure Load Test: ${count} products ============\n`);
    // Runs the init script to generate test data and populate the test database
    const init = (0, child_process_1.spawn)('node', ['-r', 'ts-node/register', './init-load-test.ts', count.toString()], {
        cwd: __dirname,
        stdio: 'inherit',
    });
    init.on('exit', async (code) => {
        if (code === 0) {
            const databaseName = `vendure-load-testing-${count}`;
            return (0, core_1.bootstrap)((0, load_test_config_1.getLoadTestConfig)('cookie', databaseName))
                .then(async (app) => {
                // await app.get(JobQueueService).start();
                const summaries = [];
                for (const script of scriptsToRun) {
                    const summary = await runLoadTestScript(script);
                    summaries.push(summary);
                }
                return closeAndExit(app, summaries);
            })
                .catch(err => {
                // eslint-disable-next-line
                console.log(err);
            });
        }
        else {
            process.exit(code || 1);
        }
    });
}
async function runLoadTestScript(script) {
    const rawResultsFile = `${script}.${count}.json`;
    return new Promise((resolve, reject) => {
        const loadTest = (0, child_process_1.spawn)('k6', ['run', `./scripts/${script}`, '--out', `json=results/${rawResultsFile}`], {
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
    }).then(() => (0, generate_summary_1.generateSummary)(rawResultsFile));
}
async function closeAndExit(app, summaries) {
    console.log('Closing server and preparing results...');
    // allow a pause for all queries to complete before closing the app
    await new Promise(resolve => setTimeout(resolve, 3000));
    await app.close();
    const dateString = getDateString();
    // write summary JSON
    const summaryData = summaries.map(s => (0, omit_1.omit)(s, ['requestDurationTimeSeries', 'concurrentUsersTimeSeries', 'requestCountTimeSeries']));
    const summaryFile = path_1.default.join(__dirname, `results/load-test-${dateString}-${count}.json`);
    fs_1.default.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2), 'utf-8');
    console.log(`Summary written to ${path_1.default.relative(__dirname, summaryFile)}`);
    // write time series CSV
    for (const summary of summaries) {
        const csvData = await getTimeSeriesCsvData(summary);
        const timeSeriesFile = path_1.default.join(__dirname, `results/load-test-${dateString}-${count}-${summary.script}.csv`);
        fs_1.default.writeFileSync(timeSeriesFile, csvData, 'utf-8');
        console.log(`Time series data written to ${path_1.default.relative(__dirname, timeSeriesFile)}`);
    }
    process.exit(0);
}
async function getTimeSeriesCsvData(summary) {
    const stringifier = (0, csv_stringify_1.stringify)({
        delimiter: ',',
    });
    const data = [];
    stringifier.on('readable', () => {
        let row;
        // eslint-disable-next-line no-cond-assign
        while ((row = stringifier.read())) {
            data.push(row);
        }
    });
    stringifier.write([
        `${summary.script}:elapsed`,
        `${summary.script}:request_duration`,
        `${summary.script}:user_count`,
        `${summary.script}:reqs`,
    ]);
    let startTime;
    for (const row of summary.requestDurationTimeSeries) {
        if (!startTime) {
            startTime = row.timestamp;
        }
        stringifier.write([row.timestamp - startTime, row.value, '', '']);
    }
    for (const row of summary.concurrentUsersTimeSeries) {
        if (!startTime) {
            startTime = row.timestamp;
        }
        stringifier.write([row.timestamp - startTime, '', row.value, '']);
    }
    for (const row of summary.requestCountTimeSeries) {
        if (!startTime) {
            startTime = row.timestamp;
        }
        stringifier.write([row.timestamp - startTime, '', '', row.value]);
    }
    stringifier.end();
    return new Promise((resolve, reject) => {
        stringifier.on('error', (err) => {
            reject(err.message);
        });
        stringifier.on('finish', async () => {
            resolve(data.join(''));
        });
    });
}
function getDateString() {
    return new Date().toISOString().split('.')[0].replace(/[:\.]/g, '_');
}
//# sourceMappingURL=run-load-test.js.map