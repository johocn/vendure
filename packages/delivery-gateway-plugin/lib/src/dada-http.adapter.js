"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchDadaHttpAdapter = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/** 基于 fetch 的实现：POST application/json 到 baseUrl+path */
class FetchDadaHttpAdapter {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async post(path, params) {
        var _a, _b;
        const url = `${this.baseUrl}${path}`;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
        }
        catch (e) {
            core_1.Logger.warn(`达达 HTTP 请求失败 ${url}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
            throw new Error(`达达请求失败: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`);
        }
        if (!res.ok) {
            throw new Error(`达达 HTTP ${res.status}: ${url}`);
        }
        return (await res.json());
    }
}
exports.FetchDadaHttpAdapter = FetchDadaHttpAdapter;
//# sourceMappingURL=dada-http.adapter.js.map