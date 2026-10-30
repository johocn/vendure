"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodicFallback = void 0;
const core_1 = require("@vendure/core");
class PeriodicFallback {
    constructor(options) {
        this.options = options;
        this.timer = null;
        this.bootTimer = null;
        this.running = false;
        this.task = null;
    }
    /** 启动（幂等）：重复调用不会挂第二套定时器 */
    start(task) {
        var _a;
        if (this.timer || this.bootTimer)
            return;
        this.task = task;
        const tick = () => this.tick();
        const bootDelayMs = (_a = this.options.bootDelayMs) !== null && _a !== void 0 ? _a : 0;
        if (bootDelayMs > 0) {
            this.bootTimer = setTimeout(() => {
                this.bootTimer = null;
                tick();
            }, bootDelayMs);
            this.unref(this.bootTimer);
        }
        this.timer = setInterval(tick, this.options.intervalMs);
        this.unref(this.timer);
    }
    /** 停止并清理（幂等） */
    stop() {
        if (this.bootTimer)
            clearTimeout(this.bootTimer);
        if (this.timer)
            clearInterval(this.timer);
        this.bootTimer = null;
        this.timer = null;
        this.task = null;
    }
    get started() {
        return this.timer !== null;
    }
    /** 手动触发一轮（运维/单测），与定时轮共享单飞保护 */
    async trigger() {
        await this.runTask();
    }
    tick() {
        void this.runTask();
    }
    async runTask() {
        var _a, _b;
        if (!this.task || this.running)
            return;
        this.running = true;
        try {
            await this.task();
        }
        catch (e) {
            core_1.Logger.error(`${this.options.name} fallback tick failed: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, (_b = this.options.loggerCtx) !== null && _b !== void 0 ? _b : 'PeriodicFallback');
        }
        finally {
            this.running = false;
        }
    }
    unref(timer) {
        var _a;
        (_a = timer === null || timer === void 0 ? void 0 : timer.unref) === null || _a === void 0 ? void 0 : _a.call(timer);
    }
}
exports.PeriodicFallback = PeriodicFallback;
//# sourceMappingURL=periodic-fallback.js.map