"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/core");
const dev_config_1 = require("./dev-config");
(0, core_1.bootstrapWorker)(dev_config_1.devConfig)
    .then(worker => worker.startJobQueue())
    .catch(err => {
    console.log(err);
    process.exit(1);
});
