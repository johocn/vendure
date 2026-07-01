"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssetUrlPrefixFn = getAssetUrlPrefixFn;
exports.getValidFormat = getValidFormat;
const core_1 = require("@vendure/core");
function getAssetUrlPrefixFn(options) {
    const { assetUrlPrefix, route } = options;
    if (assetUrlPrefix == null) {
        return (request, identifier) => {
            var _a, _b;
            const protocol = (_a = request.headers['x-forwarded-proto']) !== null && _a !== void 0 ? _a : request.protocol;
            return `${Array.isArray(protocol) ? protocol[0] : protocol}://${(_b = request.get('host')) !== null && _b !== void 0 ? _b : 'could-not-determine-host'}/${route}/`;
        };
    }
    if (typeof assetUrlPrefix === 'string') {
        return (...args) => assetUrlPrefix;
    }
    if (typeof assetUrlPrefix === 'function') {
        return (request, identifier) => {
            const ctx = (0, core_1.internal_getRequestContext)(request);
            return assetUrlPrefix(ctx, identifier);
        };
    }
    throw new Error(`The assetUrlPrefix option was of an unexpected type: ${JSON.stringify(assetUrlPrefix)}`);
}
function getValidFormat(format) {
    if (typeof format !== 'string') {
        return undefined;
    }
    switch (format) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'webp':
        case 'avif':
            return format;
        default:
            return undefined;
    }
}
//# sourceMappingURL=common.js.map