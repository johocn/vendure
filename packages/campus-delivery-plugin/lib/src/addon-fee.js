"use strict";
/**
 * 加料/小料 + 套餐/组合商品（P1-2）：配置解析、选择校验与计价的纯函数。
 * C 端前端预估展示与后端结算落账必须共用同一口径（否则页面价格与实付不符）。
 *
 * 安全前提：C 端只上传「加料选择的引用」（组名 + 选项名），**不上传金额**；
 * 金额一律由服务端按商品自身配置解析，避免前端篡改价格。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADDON_TEXT_MAX = exports.COMBO_MAX_ITEMS = exports.ADDON_MAX_PRICE_FEN = exports.ADDON_MAX_OPTIONS_PER_GROUP = exports.ADDON_MAX_GROUPS = exports.ADDON_FEE_SKU = void 0;
exports.parseAddonGroups = parseAddonGroups;
exports.parseCombo = parseCombo;
exports.resolveAddonSelection = resolveAddonSelection;
exports.buildAddonSnapshot = buildAddonSnapshot;
exports.quoteAddonFeePerLine = quoteAddonFeePerLine;
exports.quoteAddonFee = quoteAddonFee;
exports.addonDisplayText = addonDisplayText;
exports.comboOriginalPrice = comboOriginalPrice;
exports.comboItemsText = comboItemsText;
exports.serializeAddonGroups = serializeAddonGroups;
exports.serializeCombo = serializeCombo;
/** 结算 surcharge 的幂等标记：按 sku 精确识别本插件写入的加料费 */
exports.ADDON_FEE_SKU = 'campus-addon-fee';
/** 配置上限（后台保存与解析共用，防止脏数据撑爆列表/小票） */
exports.ADDON_MAX_GROUPS = 5;
exports.ADDON_MAX_OPTIONS_PER_GROUP = 12;
exports.ADDON_MAX_PRICE_FEN = 100000; // 单份加料 ≤ 1000 元
exports.COMBO_MAX_ITEMS = 20;
exports.ADDON_TEXT_MAX = 20;
function toInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
}
function clampText(v, max = exports.ADDON_TEXT_MAX) {
    const s = String(v !== null && v !== void 0 ? v : '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) : s;
}
/** 非负、不超上限的金额（分）；脏值归 0 */
function toFen(v) {
    const n = toInt(v);
    if (n <= 0)
        return 0;
    return n > exports.ADDON_MAX_PRICE_FEN ? exports.ADDON_MAX_PRICE_FEN : n;
}
/**
 * 解析商品加料组配置。入参可为 JSON 字符串或已解析对象；任何非法结构都退回空数组，绝不抛错。
 * 解析阶段即完成清洗：去空名、限长、限数量、金额归一。
 */
function parseAddonGroups(raw) {
    const arr = toArray(raw);
    const out = [];
    for (const g of arr) {
        if (!g || typeof g !== 'object')
            continue;
        const name = clampText(g.name);
        if (!name)
            continue;
        const options = [];
        for (const o of toArray(g.options)) {
            if (!o || typeof o !== 'object')
                continue;
            const on = clampText(o.name);
            if (!on)
                continue;
            options.push({ name: on, price: toFen(o.price) });
            if (options.length >= exports.ADDON_MAX_OPTIONS_PER_GROUP)
                break;
        }
        if (!options.length)
            continue;
        const rawMax = toInt(g.max);
        const rawMin = toInt(g.min);
        out.push({
            name,
            min: rawMin > 0 ? Math.min(rawMin, options.length) : 0,
            max: rawMax > 0 ? Math.min(rawMax, options.length) : 0,
            options,
        });
        if (out.length >= exports.ADDON_MAX_GROUPS)
            break;
    }
    return out;
}
/** 解析套餐配置；items 为空视为非套餐（返回 null） */
function parseCombo(raw) {
    const obj = toObject(raw);
    if (!obj)
        return null;
    const items = [];
    for (const it of toArray(obj.items)) {
        if (!it || typeof it !== 'object')
            continue;
        const name = clampText(it.name);
        if (!name)
            continue;
        const qty = Math.max(1, Math.min(99, toInt(it.qty) || 1));
        const raw = it.price;
        items.push({ name, qty, price: raw == null ? null : toFen(raw) });
        if (items.length >= exports.COMBO_MAX_ITEMS)
            break;
    }
    if (!items.length)
        return null;
    const note = clampText(obj.note, 100);
    const title = clampText(obj.title);
    return { title: title || null, items, note: note || null };
}
/**
 * 解析订单行上的加料选择快照，并按商品当前配置做「白名单过滤」：
 * 配置里不存在的组/选项一律丢弃（商品改配置后下单的旧快照不会凭空产生费用）。
 */
function resolveAddonSelection(raw, groups) {
    var _a, _b;
    const list = toArray(raw);
    if (!list.length || !groups.length)
        return [];
    const out = [];
    const seen = new Set();
    for (const s of list) {
        if (!s || typeof s !== 'object')
            continue;
        const g = clampText(s.g);
        const n = clampText(s.n);
        if (!g || !n)
            continue;
        const group = groups.find(x => x.name === g);
        if (!group || !group.options.some(o => o.name === n))
            continue;
        const key = `${g}\u0000${n}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push({ g, n });
    }
    // 逐组套用 max 上限，超选部分截断（前端已限制，服务端兜底）
    const byGroup = new Map();
    const capped = [];
    for (const s of out) {
        const group = groups.find(x => x.name === s.g);
        const used = (_a = byGroup.get(s.g)) !== null && _a !== void 0 ? _a : 0;
        const max = Number((_b = group.max) !== null && _b !== void 0 ? _b : 0);
        if (max > 0 && used >= max)
            continue;
        byGroup.set(s.g, used + 1);
        capped.push(s);
    }
    return capped;
}
/**
 * 把「加料选择引用」按商品配置解析为带价快照。
 * 配置里不存在的组/选项一律丢弃（客户端传任意字符串也无法凭空产生费用）；
 * 逐组套用 max 上限；同一组内同名去重。
 */
function buildAddonSnapshot(raw, groups) {
    const selection = resolveAddonSelection(raw, groups);
    const out = [];
    for (const s of selection) {
        const group = groups.find(x => x.name === s.g);
        const opt = group === null || group === void 0 ? void 0 : group.options.find(o => o.name === s.n);
        if (!opt)
            continue;
        out.push({ g: s.g, n: s.n, p: toFen(opt.price) });
    }
    return out;
}
/**
 * 单行加料费（分）= 服务端解析出的单份加价和 × 件数。
 * 金额始终由商品当前配置决定，OrderLine 上只存引用（不含价格），因此不存在改包篡改。
 */
function quoteAddonFeePerLine(raw, groupsRaw, quantity) {
    const groups = parseAddonGroups(groupsRaw);
    if (!groups.length)
        return 0;
    const snapshot = buildAddonSnapshot(raw, groups);
    if (!snapshot.length)
        return 0;
    const qty = Math.max(0, toInt(quantity));
    if (!qty)
        return 0;
    return snapshot.reduce((n, s) => n + s.p, 0) * qty;
}
/** 订单级加料费合计（分） */
function quoteAddonFee(lines) {
    let fee = 0;
    for (const line of lines !== null && lines !== void 0 ? lines : []) {
        fee += quoteAddonFeePerLine(line === null || line === void 0 ? void 0 : line.addons, line === null || line === void 0 ? void 0 : line.groups, line === null || line === void 0 ? void 0 : line.quantity);
    }
    return fee;
}
/** 加料展示文本（购物车/订单行/小票）：'加蛋 / 加辣' */
function addonDisplayText(raw, separator = ' / ') {
    const list = toArray(raw);
    const names = [];
    for (const s of list) {
        if (!s || typeof s !== 'object')
            continue;
        const n = clampText(s.n);
        if (n)
            names.push(n);
    }
    return names.join(separator);
}
/** 套餐原价合计（分）：仅有价格的内含项参与；返回 null 表示无法计算 */
function comboOriginalPrice(combo) {
    var _a;
    if (!((_a = combo === null || combo === void 0 ? void 0 : combo.items) === null || _a === void 0 ? void 0 : _a.length))
        return null;
    let sum = 0;
    let priced = 0;
    for (const it of combo.items) {
        if (it.price == null)
            continue;
        sum += toFen(it.price) * Math.max(1, toInt(it.qty));
        priced++;
    }
    return priced > 0 ? sum : null;
}
/** 套餐内容展示文本：'宫保鸡丁×1 / 米饭×1' */
function comboItemsText(combo, separator = ' / ') {
    var _a;
    if (!((_a = combo === null || combo === void 0 ? void 0 : combo.items) === null || _a === void 0 ? void 0 : _a.length))
        return '';
    return combo.items.map(it => `${it.name}×${Math.max(1, toInt(it.qty))}`).join(separator);
}
/** 序列化为 customFields 存储值（空结构写 null，便于「清除」语义） */
function serializeAddonGroups(groups) {
    const clean = parseAddonGroups(groups);
    return clean.length ? JSON.stringify(clean) : null;
}
function serializeCombo(combo) {
    const clean = parseCombo(combo);
    return clean ? JSON.stringify(clean) : null;
}
/** JSON 字符串 / 数组 / 对象 统一转数组 */
function toArray(raw) {
    if (raw == null)
        return [];
    if (Array.isArray(raw))
        return raw;
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s)
            return [];
        try {
            const parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch (_a) {
            return [];
        }
    }
    return Array.isArray(raw.items) ? raw.items : [];
}
function toObject(raw) {
    if (raw == null)
        return null;
    if (typeof raw === 'object')
        return raw;
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s)
            return null;
        try {
            const parsed = JSON.parse(s);
            return parsed && typeof parsed === 'object' ? parsed : null;
        }
        catch (_a) {
            return null;
        }
    }
    return null;
}
//# sourceMappingURL=addon-fee.js.map