"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.parseDistrictCodes = parseDistrictCodes;
exports.evaluateRange = evaluateRange;
exports.resolveOrderShopMap = resolveOrderShopMap;
exports.computeShopFees = computeShopFees;
exports.readOrderShippingCodes = readOrderShippingCodes;
exports.hasOrderShippingCodes = hasOrderShippingCodes;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const delivery_range_entity_1 = require("./delivery-range.entity");
/** 大地距离（km），haversine 公式。 */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
function parseDistrictCodes(raw) {
    if (!raw) {
        return new Set();
    }
    try {
        return new Set(JSON.parse(raw));
    }
    catch (_a) {
        return new Set();
    }
}
function evaluateRange(range, shopId, addr) {
    var _a, _b, _c;
    if (!range || !range.enabled) {
        return { shopId, inRange: false, reason: 'NO_DELIVERY' };
    }
    if (range.rangeType === 'all') {
        return { shopId, inRange: true, reason: 'OK' };
    }
    if (range.rangeType === 'circle') {
        if (addr.lat == null || addr.lng == null) {
            return { shopId, inRange: false, reason: 'NO_COORDINATES' };
        }
        const d = haversineKm((_a = range.centerLat) !== null && _a !== void 0 ? _a : 0, (_b = range.centerLng) !== null && _b !== void 0 ? _b : 0, addr.lat, addr.lng);
        if (d <= ((_c = range.radiusKm) !== null && _c !== void 0 ? _c : 0)) {
            return { shopId, inRange: true, reason: 'OK' };
        }
        return { shopId, inRange: false, reason: 'BEYOND_RANGE' };
    }
    if (range.rangeType === 'district') {
        const whitelist = parseDistrictCodes(range.districtCodes);
        const has = [addr.districtCode, addr.cityCode, addr.provinceCode].some(code => code != null && whitelist.has(code));
        if (has) {
            return { shopId, inRange: true, reason: 'OK' };
        }
        return { shopId, inRange: false, reason: 'NOT_IN_RANGE' };
    }
    return { shopId, inRange: false, reason: 'UNKNOWN_TYPE' };
}
/** 订单行 → 商品所属 ShopId 映射（沿 shop-plugin 的 Product.shopId 自定义字段反查）。 */
async function resolveOrderShopMap(connection, ctx, order) {
    var _a, _b, _c, _d;
    const lines = ((_a = order === null || order === void 0 ? void 0 : order.lines) !== null && _a !== void 0 ? _a : []);
    // OrderLine 无 productId 列，productId 挂在 line.productVariant.productId 上。
    const productIds = [
        ...new Set(lines.map(l => { var _a; return Number((_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.productId) || Number(l.productId); }).filter(id => id > 0)),
    ];
    const map = new Map();
    if (productIds.length === 0) {
        return map;
    }
    const products = await connection
        .getRepository(ctx, core_1.Product)
        .find({ where: { id: (0, typeorm_1.In)(productIds) } });
    const shopByProduct = new Map();
    for (const p of products) {
        const sid = (_c = (((_b = p.customFields) !== null && _b !== void 0 ? _b : {}))) === null || _c === void 0 ? void 0 : _c.shopId;
        if (sid != null) {
            shopByProduct.set(Number(p.id), Number(sid));
        }
    }
    for (const l of lines) {
        const pid = Number((_d = l.productVariant) === null || _d === void 0 ? void 0 : _d.productId) || Number(l.productId);
        const sid = shopByProduct.get(pid);
        if (sid != null) {
            map.set(pid, sid);
        }
    }
    return map;
}
/** 按店聚合订单行小计 + 运费（读 DeliveryRange.baseFee/freeThreshold）。 */
async function computeShopFees(connection, ctx, order) {
    var _a, _b, _c;
    const productShop = await resolveOrderShopMap(connection, ctx, order);
    const subtotals = new Map();
    for (const l of ((_a = order === null || order === void 0 ? void 0 : order.lines) !== null && _a !== void 0 ? _a : [])) {
        const pid = Number((_b = l.productVariant) === null || _b === void 0 ? void 0 : _b.productId) || Number(l.productId);
        const sid = productShop.get(pid);
        if (sid == null) {
            continue;
        }
        subtotals.set(sid, ((_c = subtotals.get(sid)) !== null && _c !== void 0 ? _c : 0) + (Number(l.linePriceWithTax) || 0));
    }
    const repo = connection.getRepository(ctx, delivery_range_entity_1.DeliveryRange);
    const out = [];
    for (const [shopId, subtotal] of subtotals) {
        const range = await repo.findOne({
            where: { shopId, channelId: ctx.channelId },
        });
        const baseFee = range ? range.baseFee : 0;
        const freeThreshold = range ? range.freeThreshold : null;
        const free = freeThreshold != null && freeThreshold > 0 && subtotal >= freeThreshold;
        const fee = free ? 0 : baseFee;
        out.push({ shopId, subtotal, baseFee, freeThreshold, fee });
    }
    return out;
}
/** 从 Order customFields 读收件区码/经纬度（阶段22 Order 新增字段）。 */
function readOrderShippingCodes(order) {
    var _a, _b, _c, _d, _e, _f;
    const cf = ((_a = order === null || order === void 0 ? void 0 : order.customFields) !== null && _a !== void 0 ? _a : {});
    return {
        lng: (_b = cf === null || cf === void 0 ? void 0 : cf.shippingLng) !== null && _b !== void 0 ? _b : null,
        lat: (_c = cf === null || cf === void 0 ? void 0 : cf.shippingLat) !== null && _c !== void 0 ? _c : null,
        provinceCode: (_d = cf === null || cf === void 0 ? void 0 : cf.shippingProvinceCode) !== null && _d !== void 0 ? _d : null,
        cityCode: (_e = cf === null || cf === void 0 ? void 0 : cf.shippingCityCode) !== null && _e !== void 0 ? _e : null,
        districtCode: (_f = cf === null || cf === void 0 ? void 0 : cf.shippingDistrictCode) !== null && _f !== void 0 ? _f : null,
    };
}
/** 是否已具备可参与校验的收件码（任一非空）。 */
function hasOrderShippingCodes(order) {
    const c = readOrderShippingCodes(order);
    return [c.lng, c.lat, c.provinceCode, c.cityCode, c.districtCode].some(v => v != null && v !== '');
}
//# sourceMappingURL=shipping-rules.js.map