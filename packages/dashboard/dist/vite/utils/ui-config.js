import { ADMIN_API_PATH, DEFAULT_AUTH_TOKEN_HEADER_KEY, DEFAULT_CHANNEL_TOKEN_KEY, } from '@vendure/common/lib/shared-constants';
import { defaultAvailableLanguages, defaultAvailableLocales, defaultLanguage, defaultLocale, } from '../constants.js';
export function getUiConfig(config, pluginOptions) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    const { authOptions, apiOptions } = config;
    const serverTokenMethod = authOptions.tokenMethod;
    const serverUsesBearer = serverTokenMethod === 'bearer' ||
        (Array.isArray(serverTokenMethod) && serverTokenMethod.includes('bearer'));
    // Merge API configuration with defaults
    const api = {
        adminApiPath: (_c = (_b = (_a = pluginOptions.api) === null || _a === void 0 ? void 0 : _a.adminApiPath) !== null && _b !== void 0 ? _b : apiOptions.adminApiPath) !== null && _c !== void 0 ? _c : ADMIN_API_PATH,
        host: (_e = (_d = pluginOptions.api) === null || _d === void 0 ? void 0 : _d.host) !== null && _e !== void 0 ? _e : 'auto',
        port: (_g = (_f = pluginOptions.api) === null || _f === void 0 ? void 0 : _f.port) !== null && _g !== void 0 ? _g : 'auto',
        tokenMethod: (_j = (_h = pluginOptions.api) === null || _h === void 0 ? void 0 : _h.tokenMethod) !== null && _j !== void 0 ? _j : (serverUsesBearer ? 'bearer' : 'cookie'),
        authTokenHeaderKey: (_m = (_l = (_k = pluginOptions.api) === null || _k === void 0 ? void 0 : _k.authTokenHeaderKey) !== null && _l !== void 0 ? _l : authOptions.authTokenHeaderKey) !== null && _m !== void 0 ? _m : DEFAULT_AUTH_TOKEN_HEADER_KEY,
        channelTokenKey: (_q = (_p = (_o = pluginOptions.api) === null || _o === void 0 ? void 0 : _o.channelTokenKey) !== null && _p !== void 0 ? _p : apiOptions.channelTokenKey) !== null && _q !== void 0 ? _q : DEFAULT_CHANNEL_TOKEN_KEY,
    };
    // Merge i18n configuration with defaults
    const i18n = {
        defaultLanguage: (_s = (_r = pluginOptions.i18n) === null || _r === void 0 ? void 0 : _r.defaultLanguage) !== null && _s !== void 0 ? _s : defaultLanguage,
        defaultLocale: (_u = (_t = pluginOptions.i18n) === null || _t === void 0 ? void 0 : _t.defaultLocale) !== null && _u !== void 0 ? _u : defaultLocale,
        availableLanguages: ((_v = pluginOptions.i18n) === null || _v === void 0 ? void 0 : _v.availableLanguages) && pluginOptions.i18n.availableLanguages.length > 0
            ? pluginOptions.i18n.availableLanguages
            : defaultAvailableLanguages,
        availableLocales: ((_w = pluginOptions.i18n) === null || _w === void 0 ? void 0 : _w.availableLocales) && pluginOptions.i18n.availableLocales.length > 0
            ? pluginOptions.i18n.availableLocales
            : defaultAvailableLocales,
    };
    // Merge orders configuration with defaults
    // Default labels are identifiers that get translated via getTranslatedRefundReason()
    const orders = {
        refundReasons: ((_x = pluginOptions.orders) === null || _x === void 0 ? void 0 : _x.refundReasons) && pluginOptions.orders.refundReasons.length > 0
            ? pluginOptions.orders.refundReasons
            : [
                { value: 'customer-request', label: 'CustomerRequest' },
                { value: 'not-available', label: 'NotAvailable' },
                { value: 'damaged-shipping', label: 'DamagedInShipping' },
                { value: 'wrong-item', label: 'WrongItem' },
                { value: 'other', label: 'Other' },
            ],
    };
    return {
        api,
        i18n,
        orders,
    };
}
