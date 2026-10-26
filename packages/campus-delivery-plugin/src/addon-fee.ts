/**
 * 加料/小料 + 套餐/组合商品（P1-2）：配置解析、选择校验与计价的纯函数。
 * C 端前端预估展示与后端结算落账必须共用同一口径（否则页面价格与实付不符）。
 *
 * 安全前提：C 端只上传「加料选择的引用」（组名 + 选项名），**不上传金额**；
 * 金额一律由服务端按商品自身配置解析，避免前端篡改价格。
 */

/** 结算 surcharge 的幂等标记：按 sku 精确识别本插件写入的加料费 */
export const ADDON_FEE_SKU = 'campus-addon-fee';

/** 配置上限（后台保存与解析共用，防止脏数据撑爆列表/小票） */
export const ADDON_MAX_GROUPS = 5;
export const ADDON_MAX_OPTIONS_PER_GROUP = 12;
export const ADDON_MAX_PRICE_FEN = 100_000; // 单份加料 ≤ 1000 元
export const COMBO_MAX_ITEMS = 20;
export const ADDON_TEXT_MAX = 20;

export interface AddonOptionConfig {
    name: string;
    /** 加价（分），0 = 免费加料 */
    price: number;
}

export interface AddonGroupConfig {
    name: string;
    /** 最少选几项（0/undefined = 不必选；≥1 = 必选） */
    min?: number | null;
    /** 最多选几项（0/null/undefined = 不限） */
    max?: number | null;
    options: AddonOptionConfig[];
}

export interface ComboItemConfig {
    name: string;
    qty: number;
    /** 单份参考价（分，可空）；用于 C 端计算「原价 / 立省」 */
    price?: number | null;
}

export interface ComboConfig {
    title?: string | null;
    items: ComboItemConfig[];
    note?: string | null;
}

/** 加料选择引用：仅组名 + 选项名，金额由服务端解析（写库前） */
export interface AddonSelection {
    g: string;
    n: string;
}

/** 加料快照（解析结果）：组名 + 选项名 + 单份加价（分） */
export interface AddonSnapshot {
    g: string;
    n: string;
    /** 单份加价（分） */
    p: number;
}

function toInt(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
}

function clampText(v: unknown, max = ADDON_TEXT_MAX): string {
    const s = String(v ?? '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) : s;
}

/** 非负、不超上限的金额（分）；脏值归 0 */
function toFen(v: unknown): number {
    const n = toInt(v);
    if (n <= 0) return 0;
    return n > ADDON_MAX_PRICE_FEN ? ADDON_MAX_PRICE_FEN : n;
}

/**
 * 解析商品加料组配置。入参可为 JSON 字符串或已解析对象；任何非法结构都退回空数组，绝不抛错。
 * 解析阶段即完成清洗：去空名、限长、限数量、金额归一。
 */
export function parseAddonGroups(raw: unknown): AddonGroupConfig[] {
    const arr = toArray(raw);
    const out: AddonGroupConfig[] = [];
    for (const g of arr) {
        if (!g || typeof g !== 'object') continue;
        const name = clampText((g as any).name);
        if (!name) continue;
        const options: AddonOptionConfig[] = [];
        for (const o of toArray((g as any).options)) {
            if (!o || typeof o !== 'object') continue;
            const on = clampText((o as any).name);
            if (!on) continue;
            options.push({ name: on, price: toFen((o as any).price) });
            if (options.length >= ADDON_MAX_OPTIONS_PER_GROUP) break;
        }
        if (!options.length) continue;
        const rawMax = toInt((g as any).max);
        const rawMin = toInt((g as any).min);
        out.push({
            name,
            min: rawMin > 0 ? Math.min(rawMin, options.length) : 0,
            max: rawMax > 0 ? Math.min(rawMax, options.length) : 0,
            options,
        });
        if (out.length >= ADDON_MAX_GROUPS) break;
    }
    return out;
}

/** 解析套餐配置；items 为空视为非套餐（返回 null） */
export function parseCombo(raw: unknown): ComboConfig | null {
    const obj = toObject(raw);
    if (!obj) return null;
    const items: ComboItemConfig[] = [];
    for (const it of toArray((obj as any).items)) {
        if (!it || typeof it !== 'object') continue;
        const name = clampText((it as any).name);
        if (!name) continue;
        const qty = Math.max(1, Math.min(99, toInt((it as any).qty) || 1));
        const raw = (it as any).price;
        items.push({ name, qty, price: raw == null ? null : toFen(raw) });
        if (items.length >= COMBO_MAX_ITEMS) break;
    }
    if (!items.length) return null;
    const note = clampText((obj as any).note, 100);
    const title = clampText((obj as any).title);
    return { title: title || null, items, note: note || null };
}

/**
 * 解析订单行上的加料选择快照，并按商品当前配置做「白名单过滤」：
 * 配置里不存在的组/选项一律丢弃（商品改配置后下单的旧快照不会凭空产生费用）。
 */
export function resolveAddonSelection(raw: unknown, groups: AddonGroupConfig[]): AddonSelection[] {
    const list = toArray(raw);
    if (!list.length || !groups.length) return [];
    const out: AddonSelection[] = [];
    const seen = new Set<string>();
    for (const s of list) {
        if (!s || typeof s !== 'object') continue;
        const g = clampText((s as any).g);
        const n = clampText((s as any).n);
        if (!g || !n) continue;
        const group = groups.find(x => x.name === g);
        if (!group || !group.options.some(o => o.name === n)) continue;
        const key = `${g}\u0000${n}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ g, n });
    }
    // 逐组套用 max 上限，超选部分截断（前端已限制，服务端兜底）
    const byGroup = new Map<string, number>();
    const capped: AddonSelection[] = [];
    for (const s of out) {
        const group = groups.find(x => x.name === s.g)!;
        const used = byGroup.get(s.g) ?? 0;
        const max = Number(group.max ?? 0);
        if (max > 0 && used >= max) continue;
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
export function buildAddonSnapshot(raw: unknown, groups: AddonGroupConfig[]): AddonSnapshot[] {
    const selection = resolveAddonSelection(raw, groups);
    const out: AddonSnapshot[] = [];
    for (const s of selection) {
        const group = groups.find(x => x.name === s.g);
        const opt = group?.options.find(o => o.name === s.n);
        if (!opt) continue;
        out.push({ g: s.g, n: s.n, p: toFen(opt.price) });
    }
    return out;
}

/**
 * 单行加料费（分）= 服务端解析出的单份加价和 × 件数。
 * 金额始终由商品当前配置决定，OrderLine 上只存引用（不含价格），因此不存在改包篡改。
 */
export function quoteAddonFeePerLine(
    raw: unknown,
    groupsRaw: unknown,
    quantity: number,
): number {
    const groups = parseAddonGroups(groupsRaw);
    if (!groups.length) return 0;
    const snapshot = buildAddonSnapshot(raw, groups);
    if (!snapshot.length) return 0;
    const qty = Math.max(0, toInt(quantity));
    if (!qty) return 0;
    return snapshot.reduce((n, s) => n + s.p, 0) * qty;
}

/** 订单级加料费合计（分） */
export function quoteAddonFee(
    lines: Array<{ addons: unknown; groups: unknown; quantity: number }>,
): number {
    let fee = 0;
    for (const line of lines ?? []) {
        fee += quoteAddonFeePerLine(line?.addons, line?.groups, line?.quantity);
    }
    return fee;
}

/** 加料展示文本（购物车/订单行/小票）：'加蛋 / 加辣' */
export function addonDisplayText(raw: unknown, separator = ' / '): string {
    const list = toArray(raw);
    const names: string[] = [];
    for (const s of list) {
        if (!s || typeof s !== 'object') continue;
        const n = clampText((s as any).n);
        if (n) names.push(n);
    }
    return names.join(separator);
}

/** 套餐原价合计（分）：仅有价格的内含项参与；返回 null 表示无法计算 */
export function comboOriginalPrice(combo: ComboConfig | null | undefined): number | null {
    if (!combo?.items?.length) return null;
    let sum = 0;
    let priced = 0;
    for (const it of combo.items) {
        if (it.price == null) continue;
        sum += toFen(it.price) * Math.max(1, toInt(it.qty));
        priced++;
    }
    return priced > 0 ? sum : null;
}

/** 套餐内容展示文本：'宫保鸡丁×1 / 米饭×1' */
export function comboItemsText(combo: ComboConfig | null | undefined, separator = ' / '): string {
    if (!combo?.items?.length) return '';
    return combo.items.map(it => `${it.name}×${Math.max(1, toInt(it.qty))}`).join(separator);
}

/** 序列化为 customFields 存储值（空结构写 null，便于「清除」语义） */
export function serializeAddonGroups(groups: AddonGroupConfig[]): string | null {
    const clean = parseAddonGroups(groups);
    return clean.length ? JSON.stringify(clean) : null;
}

export function serializeCombo(combo: ComboConfig | null | undefined): string | null {
    const clean = parseCombo(combo);
    return clean ? JSON.stringify(clean) : null;
}

/** JSON 字符串 / 数组 / 对象 统一转数组 */
function toArray(raw: unknown): any[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return [];
        try {
            const parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return Array.isArray((raw as any).items) ? (raw as any).items : [];
}

function toObject(raw: unknown): Record<string, any> | null {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw as Record<string, any>;
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return null;
        try {
            const parsed = JSON.parse(s);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
}
