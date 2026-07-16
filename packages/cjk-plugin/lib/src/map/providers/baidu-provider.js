"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaiduProvider = void 0;
class BaiduProvider {
    constructor() {
        this.name = 'baidu';
    }
    getSdkLoaderUrl(apiKey, securityJsCode) {
        return `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(apiKey)}`;
    }
    async fetchDistricts(parentAdcode, apiKey) {
        throw new Error('百度地图 Provider 尚未实现，请使用高德');
    }
    async reverseGeocode(lat, lng, apiKey) {
        throw new Error('百度地图 Provider 尚未实现，请使用高德');
    }
}
exports.BaiduProvider = BaiduProvider;
//# sourceMappingURL=baidu-provider.js.map