"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TencentProvider = void 0;
class TencentProvider {
    constructor() {
        this.name = 'tencent';
    }
    getSdkLoaderUrl(apiKey, securityJsCode) {
        return `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(apiKey)}`;
    }
    async fetchDistricts(parentAdcode, apiKey) {
        throw new Error('腾讯地图 Provider 尚未实现，请使用高德');
    }
    async reverseGeocode(lat, lng, apiKey) {
        throw new Error('腾讯地图 Provider 尚未实现，请使用高德');
    }
}
exports.TencentProvider = TencentProvider;
//# sourceMappingURL=tencent-provider.js.map