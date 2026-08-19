"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitShippingCalculator = void 0;
const core_1 = require("@vendure/core");
const DEFAULT_BASE_FEE = 1000; // 分
const DEFAULT_PER_KM = 200; // 分/公里
/** 供计费落库使用的连接（init 注入） */
let connection;
/**
 * 每包裹独立计费：读取订单拆分明细 stockLocationsJson，
 * 逐包按 channel 级 packageShippingRule 计费后合计为一笔运费。
 * 计费结果明细写入 Order.packageShippingJson，供前端「运费明细」区块展示。
 */
exports.splitShippingCalculator = new core_1.ShippingCalculator({
    code: 'split-package-shipping',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '多仓拆单每包裹独立计费' },
        { languageCode: core_1.LanguageCode.en, value: 'Split Package Shipping Calculator' },
    ],
    args: {},
    init(injector) {
        connection = injector.get(core_1.TransactionalConnection);
    },
    calculate: async (ctx, order, args) => {
        var _a, _b, _c, _d, _e, _f;
        const ccf = ((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {});
        const rules = parseRules(ccf.packageShippingRule);
        const lines = collectLines(order);
        if (lines.length === 0) {
            return { price: 0, priceIncludesTax: true, taxRate: 0 };
        }
        let total = 0;
        const detail = [];
        for (const loc of lines) {
            const rule = rules.find(r => String(r.locationId) === String(loc.locationId));
            const base = (_c = rule === null || rule === void 0 ? void 0 : rule.baseFee) !== null && _c !== void 0 ? _c : DEFAULT_BASE_FEE;
            const perKm = (_d = rule === null || rule === void 0 ? void 0 : rule.perKmFee) !== null && _d !== void 0 ? _d : DEFAULT_PER_KM;
            const freeThreshold = (_e = rule === null || rule === void 0 ? void 0 : rule.freeThreshold) !== null && _e !== void 0 ? _e : 0;
            if (freeThreshold > 0 && order.subTotal >= freeThreshold) {
                total += 0;
                detail.push({ locationId: String(loc.locationId), fee: 0 });
                continue;
            }
            const distance = (_f = loc.distanceKm) !== null && _f !== void 0 ? _f : 0;
            const fee = base + Math.round(perKm * distance);
            total += fee;
            detail.push({ locationId: String(loc.locationId), fee });
        }
        await persistPackageShipping(ctx, order, detail);
        return { price: total, priceIncludesTax: true, taxRate: 0 };
    },
});
function collectLines(order) {
    var _a, _b;
    const out = [];
    const seen = new Set();
    for (const line of ((_a = order.lines) !== null && _a !== void 0 ? _a : [])) {
        const raw = (_b = line.customFields) === null || _b === void 0 ? void 0 : _b.stockLocationsJson;
        let detail = [];
        try {
            detail = Array.isArray(raw) ? raw : JSON.parse(String(raw !== null && raw !== void 0 ? raw : '[]'));
        }
        catch (_c) {
            detail = [];
        }
        for (const d of detail) {
            if (!seen.has(d.locationId)) {
                seen.add(d.locationId);
                out.push({ locationId: d.locationId, distanceKm: 0 });
            }
        }
    }
    return out;
}
function parseRules(raw) {
    try {
        const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw !== null && raw !== void 0 ? raw : '[]'));
        return Array.isArray(arr) ? arr : [];
    }
    catch (_a) {
        return [];
    }
}
async function persistPackageShipping(ctx, order, detail) {
    var _a;
    try {
        if (!connection) {
            return;
        }
        const cf = Object.assign(Object.assign({}, ((_a = order.customFields) !== null && _a !== void 0 ? _a : {})), { packageShippingJson: JSON.stringify(detail) });
        const repo = connection.getRepository(ctx, core_1.Order);
        const fresh = await repo.findOne({ where: { id: order.id } });
        if (fresh) {
            fresh.customFields = cf;
            await repo.save((await import('@vendure/common/lib/pick')).pick(fresh, ['id', 'customFields']), { reload: false });
        }
    }
    catch (e) {
        /* 运费明细落库失败不阻断计费 */
    }
}
//# sourceMappingURL=split-shipping-calculator.js.map