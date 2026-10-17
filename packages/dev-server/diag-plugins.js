"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
require("dotenv/config");
const core_1 = require("@vendure/core");
const dev_config_1 = require("./dev-config");
(async () => {
    var _a, _b, _c, _d, _e;
    // 模拟 preBootstrapConfig：先 setConfig(userConfig)，再 runPluginConfigurations(getConfig())
    await (0, core_1.setConfig)(dev_config_1.devConfig);
    const c1 = await (0, core_1.runPluginConfigurations)((0, core_1.getConfig)());
    console.log('[after run1] Address=', (_a = c1.customFields.Address) === null || _a === void 0 ? void 0 : _a.length);
    // 再次 setConfig + runPluginConfigurations（模拟 bootstrap 内再次调用）
    await (0, core_1.setConfig)(dev_config_1.devConfig);
    const c2 = await (0, core_1.runPluginConfigurations)((0, core_1.getConfig)());
    console.log('[after run2] Address=', (_b = c2.customFields.Address) === null || _b === void 0 ? void 0 : _b.length);
    for (const entity of ['Address', 'OrderLine', 'StockMovement']) {
        const fields = ((_d = (_c = c2.customFields) === null || _c === void 0 ? void 0 : _c[entity]) !== null && _d !== void 0 ? _d : []);
        const counts = {};
        for (const f of fields)
            counts[f.name] = ((_e = counts[f.name]) !== null && _e !== void 0 ? _e : 0) + 1;
        const dups = Object.entries(counts).filter(([, c]) => c > 1);
        console.log(`[${entity}] total=${fields.length} dups=${JSON.stringify(dups)}`);
    }
})().catch(e => {
    var _a;
    console.error('ERR', (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e);
    process.exit(1);
});
//# sourceMappingURL=diag-plugins.js.map