"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.perf = perf;
/** 简易耗时计时：perf() 返回起点 ms，perf(t0) 返回距 t0 已过的 ms。用 performance.now 精确到亚毫秒。 */
function perf(t0) {
    if (t0 == null)
        return performance.now();
    return Math.round(performance.now() - t0);
}
//# sourceMappingURL=timing.util.js.map