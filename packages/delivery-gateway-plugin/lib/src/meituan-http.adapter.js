"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeituanHttpAdapter = void 0;
const core_1 = require("@vendure/core");
const meituan_signature_1 = require("./meituan-signature");
const constants_1 = require("./constants");
const DEFAULT_BASE_URL = 'https://peisongopen.meituan.com';
const DEFAULT_TIMEOUT = 8000;
/** 美团开放平台 HTTP：application/x-www-form-urlencoded，统一错误归一 */
class MeituanHttpAdapter {
    constructor(config) {
        this.config = config;
    }
    get baseUrl() {
        var _a;
        return ((_a = this.config.baseUrl) !== null && _a !== void 0 ? _a : DEFAULT_BASE_URL).replace(/\/$/, '');
    }
    async post(path, body) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const apiUrl = `${this.baseUrl}${path}`;
        const params = (0, meituan_signature_1.buildMeituanParams)(this.config.appKey, this.config.appSecret, this.config.signMode, body, Math.floor(Date.now() / 1000), apiUrl);
        const form = new URLSearchParams(params);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), (_a = this.config.timeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_TIMEOUT);
        let res;
        try {
            res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(),
                signal: ctrl.signal,
            });
        }
        catch (e) {
            core_1.Logger.warn(`美团请求失败 ${path}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
            throw e;
        }
        finally {
            clearTimeout(timer);
        }
        if (!res.ok) {
            throw new Error(`美团 HTTP ${res.status} ${path}`);
        }
        const json = (await res.json());
        // 兼容 data.code / code 两种返回包裹
        const code = Number((_e = (_c = json === null || json === void 0 ? void 0 : json.code) !== null && _c !== void 0 ? _c : (_d = json === null || json === void 0 ? void 0 : json.data) === null || _d === void 0 ? void 0 : _d.code) !== null && _e !== void 0 ? _e : 0);
        if (code !== 0) {
            throw new Error(`美团业务错误 ${code}: ${(_h = (_f = json === null || json === void 0 ? void 0 : json.msg) !== null && _f !== void 0 ? _f : (_g = json === null || json === void 0 ? void 0 : json.data) === null || _g === void 0 ? void 0 : _g.message) !== null && _h !== void 0 ? _h : 'unknown'}`);
        }
        return ((_j = json === null || json === void 0 ? void 0 : json.data) !== null && _j !== void 0 ? _j : json);
    }
}
exports.MeituanHttpAdapter = MeituanHttpAdapter;
//# sourceMappingURL=meituan-http.adapter.js.map