"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopTrackingProvider = void 0;
class NoopTrackingProvider {
    constructor() {
        this.code = 'noop';
        this.name = 'Noop (未配置)';
    }
    async queryTrack() {
        return { status: 'unknown', tracks: [] };
    }
}
exports.NoopTrackingProvider = NoopTrackingProvider;
//# sourceMappingURL=tracking-provider.js.map