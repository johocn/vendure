"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDevModeOptions = isDevModeOptions;
exports.resolveTransportSettings = resolveTransportSettings;
function isDevModeOptions(input) {
    return input.devMode === true;
}
async function resolveTransportSettings(options, injector, ctx) {
    if (typeof options.transport === 'function') {
        return options.transport(injector, ctx);
    }
    else {
        return options.transport;
    }
}
//# sourceMappingURL=common.js.map