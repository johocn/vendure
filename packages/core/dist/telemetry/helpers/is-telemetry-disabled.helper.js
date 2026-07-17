"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTelemetryDisabled = isTelemetryDisabled;
const ci_detector_helper_1 = require("./ci-detector.helper");
/**
 * Checks if telemetry is disabled via the VENDURE_DISABLE_TELEMETRY environment
 * variable or CI environment detection.
 */
function isTelemetryDisabled() {
    var _a;
    const disableEnv = (_a = process.env.VENDURE_DISABLE_TELEMETRY) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    return disableEnv === 'true' || disableEnv === '1' || (0, ci_detector_helper_1.isCI)();
}
//# sourceMappingURL=is-telemetry-disabled.helper.js.map