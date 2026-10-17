"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/core");
const dev_config_1 = require("./dev-config");
(0, core_1.bootstrapWorker)(dev_config_1.devConfig)
    .then(worker => worker.startJobQueue())
    // .then(worker => worker.startHealthCheckServer({ port: 3001 }))
    .catch(err => {
    // eslint-disable-next-line
    console.log(err);
    process.exit(1);
});
//# sourceMappingURL=index-worker.js.map