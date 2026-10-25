"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codesFromAdcode = codesFromAdcode;
exports.extractPhone = extractPhone;
exports.buildParsedAddress = buildParsedAddress;
function codesFromAdcode(adcode) {
    const code = String(adcode !== null && adcode !== void 0 ? adcode : '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { provinceCode: null, cityCode: null, districtCode: null };
    }
    return {
        provinceCode: `${code.slice(0, 2)}0000`,
        cityCode: `${code.slice(0, 4)}00`,
        districtCode: code,
    };
}
function extractPhone(text) {
    const m = /(1[3-9]\d{9})/.exec(text);
    if (!m)
        return { phoneNumber: null, rest: text.trim() };
    return {
        phoneNumber: m[1],
        rest: text.replace(m[1], '').replace(/\s+/g, ' ').trim(),
    };
}
function buildParsedAddress(geo, rawText) {
    var _a, _b, _c, _d, _e;
    const { phoneNumber, rest } = extractPhone(rawText);
    const codes = codesFromAdcode(geo === null || geo === void 0 ? void 0 : geo.adcode);
    const missing = [];
    if (!(geo === null || geo === void 0 ? void 0 : geo.city))
        missing.push('city');
    if (!codes.cityCode || !(geo === null || geo === void 0 ? void 0 : geo.district))
        missing.push('district');
    if (!(geo === null || geo === void 0 ? void 0 : geo.formattedAddress) && !rest)
        missing.push('street');
    if (!phoneNumber)
        missing.push('phone');
    return {
        province: (_a = geo === null || geo === void 0 ? void 0 : geo.province) !== null && _a !== void 0 ? _a : null,
        city: (_b = geo === null || geo === void 0 ? void 0 : geo.city) !== null && _b !== void 0 ? _b : null,
        cityCode: codes.cityCode,
        district: (_c = geo === null || geo === void 0 ? void 0 : geo.district) !== null && _c !== void 0 ? _c : null,
        districtCode: codes.districtCode,
        provinceCode: codes.provinceCode,
        streetLine1: (geo === null || geo === void 0 ? void 0 : geo.formattedAddress) || rest,
        phoneNumber,
        lat: (_d = geo === null || geo === void 0 ? void 0 : geo.lat) !== null && _d !== void 0 ? _d : null,
        lng: (_e = geo === null || geo === void 0 ? void 0 : geo.lng) !== null && _e !== void 0 ? _e : null,
        missing,
    };
}
//# sourceMappingURL=address-parser.js.map