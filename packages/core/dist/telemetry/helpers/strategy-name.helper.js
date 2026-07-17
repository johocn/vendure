"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStrategyName = getStrategyName;
/**
 * Gets the name of a strategy, resilient to code minification.
 * Prefers an explicit `name` property (e.g. AuthenticationStrategy.name),
 * then falls back to `constructor.name`. Returns 'unknown' if the name
 * appears to be minified (single char or empty).
 */
function getStrategyName(strategy) {
    var _a;
    if (strategy == null) {
        return 'unknown';
    }
    const name = strategy.name;
    if (typeof name === 'string' && name.length > 1) {
        return name;
    }
    const ctorName = (_a = strategy.constructor) === null || _a === void 0 ? void 0 : _a.name;
    if (ctorName && ctorName.length > 1) {
        return ctorName;
    }
    return 'unknown';
}
//# sourceMappingURL=strategy-name.helper.js.map