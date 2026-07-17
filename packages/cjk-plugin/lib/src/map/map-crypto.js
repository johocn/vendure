"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptMapConfig = encryptMapConfig;
exports.decryptMapConfig = decryptMapConfig;
exports.maskMapConfig = maskMapConfig;
exports.mergeMapConfig = mergeMapConfig;
const crypto_1 = require("../auth/crypto");
const SECRET_FIELDS = ['apiKey', 'securityJsCode'];
function encryptMapConfig(config) {
    if (!config)
        return null;
    const out = Object.assign({}, config);
    for (const field of SECRET_FIELDS) {
        const val = out[field];
        if (typeof val === 'string' && val && !(0, crypto_1.isEncrypted)(val)) {
            out[field] = (0, crypto_1.encrypt)(val);
        }
    }
    return out;
}
function decryptMapConfig(config) {
    if (!config)
        return null;
    const out = Object.assign({}, config);
    for (const field of SECRET_FIELDS) {
        const val = out[field];
        if (typeof val === 'string' && val && (0, crypto_1.isEncrypted)(val)) {
            out[field] = (0, crypto_1.decrypt)(val);
        }
    }
    return out;
}
function maskMapConfig(config) {
    if (!config)
        return null;
    const out = Object.assign({}, config);
    for (const field of SECRET_FIELDS) {
        if (typeof out[field] === 'string' && out[field]) {
            out[field] = '*******';
        }
    }
    return out;
}
function mergeMapConfig(original, patch) {
    if (!patch)
        return original;
    const out = Object.assign({}, (original || { provider: 'amap', apiKey: '' }));
    for (const key of Object.keys(patch)) {
        const val = patch[key];
        if (val === '***')
            continue;
        out[key] = val;
    }
    return out;
}
//# sourceMappingURL=map-crypto.js.map