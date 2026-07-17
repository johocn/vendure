"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/core");
const commander_1 = require("commander");
const dev_config_1 = require("./dev-config");
commander_1.program
    .command('generate <name>')
    .description('Generate a new migration file with the given name')
    .action(async (name) => {
    await (0, core_1.generateMigration)(dev_config_1.devConfig, { name, outputDir: './migrations' });
});
commander_1.program
    .command('run')
    .description('Run all pending migrations')
    .action(async () => {
    await (0, core_1.runMigrations)(dev_config_1.devConfig);
});
commander_1.program
    .command('revert')
    .description('Revert the last applied migration')
    .action(() => {
    return (0, core_1.revertLastMigration)(dev_config_1.devConfig);
});
commander_1.program.parse(process.argv);
