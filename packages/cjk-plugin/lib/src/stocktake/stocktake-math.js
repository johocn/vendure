"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAVE_STATES = exports.TASK_STATES = void 0;
exports.canTaskTransition = canTaskTransition;
exports.canWaveTransition = canWaveTransition;
exports.formatTaskCode = formatTaskCode;
exports.nextTaskSeq = nextTaskSeq;
exports.buildExpected = buildExpected;
exports.variantSnapBook = variantSnapBook;
exports.summarizeVariance = summarizeVariance;
exports.buildPostItems = buildPostItems;
exports.resolveWaveStateAfterCount = resolveWaveStateAfterCount;
exports.resolveTaskStateAfterWaves = resolveTaskStateAfterWaves;
exports.waveOwnerError = waveOwnerError;
exports.resolveScanCode = resolveScanCode;
exports.TASK_STATES = ['DRAFT', 'OPEN', 'COUNTING', 'COUNTED', 'POSTED', 'CANCELLED'];
exports.WAVE_STATES = ['OPEN', 'CLAIMED', 'COUNTING', 'SUBMITTED', 'CANCELLED'];
const TASK_EDGES = {
    DRAFT: ['OPEN', 'CANCELLED'],
    OPEN: ['COUNTING', 'COUNTED', 'CANCELLED'],
    COUNTING: ['COUNTED', 'CANCELLED'],
    COUNTED: ['POSTED', 'CANCELLED'],
    POSTED: [],
    CANCELLED: [],
};
const WAVE_EDGES = {
    OPEN: ['CLAIMED', 'CANCELLED'],
    CLAIMED: ['COUNTING', 'OPEN', 'CANCELLED'], // → OPEN 即「释放」（清空负责人）
    COUNTING: ['SUBMITTED', 'OPEN', 'CANCELLED'], // → OPEN 即「释放」（清空负责人）
    SUBMITTED: [],
    CANCELLED: [],
};
function canTaskTransition(from, to) {
    return (TASK_EDGES[from] || []).includes(to);
}
function canWaveTransition(from, to) {
    return (WAVE_EDGES[from] || []).includes(to);
}
/** 任务号：TK + yyyymmdd + 三位流水 */
function formatTaskCode(now, seq) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `TK${y}${m}${d}-${String(seq).padStart(3, '0')}`;
}
/** 从既有任务号里取当日最大流水 +1（跨渠道各算各的，调用方传入本渠道的号） */
function nextTaskSeq(codes, now) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `TK${y}${m}${d}-`;
    let max = 0;
    for (const code of codes) {
        if (!code || !code.startsWith(prefix))
            continue;
        const n = Number.parseInt(code.slice(prefix.length), 10);
        if (Number.isFinite(n) && n > max)
            max = n;
    }
    return max + 1;
}
/**
 * 应盘清单 = 已归位 ∪ 有账面（规格 §3.4/§6.1）。
 * - bookRows 先按 variantId 归并求和（同变体多库存行）
 * - 有绑定 → 每个 (zoneId, binId) 一行；无绑定 → 未归位桶
 * - scope.zones 之外的绑定 → 也退入未归位桶（**不丢行**）
 * - binMode=off → 只建一个 whole 盘次，库位一律为空
 */
function buildExpected(input) {
    var _a, _b, _c;
    const { binMode, bookRows, bindRows, variantMeta, zoneMeta, scope } = input;
    const book = new Map();
    for (const r of bookRows) {
        book.set(r.variantId, (book.get(r.variantId) || 0) + (r.quantity || 0));
    }
    if (!scope.includeZeroBook) {
        for (const [variantId, qty] of Array.from(book.entries())) {
            if (qty <= 0)
                book.delete(variantId);
        }
    }
    const bindByVariant = new Map();
    for (const b of bindRows) {
        const list = bindByVariant.get(b.variantId) || [];
        list.push(b);
        bindByVariant.set(b.variantId, list);
    }
    const scopeVariants = scope.variantIds.length ? new Set(scope.variantIds) : null;
    const scopeZones = scope.zones.length ? new Set(scope.zones) : null;
    const candidates = new Set([...book.keys(), ...bindByVariant.keys()]);
    const meta = (variantId) => variantMeta.get(variantId) || { sku: `#${variantId}`, name: '' };
    const bookOf = (variantId) => book.get(variantId) || 0;
    // waveKey: 'zone:{id}' | 'unassigned' | 'whole'
    const groups = new Map();
    const ensureGroup = (key, make) => {
        let g = groups.get(key);
        if (!g) {
            g = { wave: make(), lines: [] };
            groups.set(key, g);
        }
        return g;
    };
    for (const variantId of Array.from(candidates).sort((a, b) => a - b)) {
        if (scopeVariants && !scopeVariants.has(variantId))
            continue;
        const m = meta(variantId);
        const bookQty = bookOf(variantId);
        const binds = (bindByVariant.get(variantId) || []).filter((b) => !scopeZones || scopeZones.has(b.zoneId));
        if (binMode === 'off') {
            const g = ensureGroup('whole', () => ({
                scopeType: 'whole', zoneId: null, zoneCode: null, zoneName: null, expectedCount: 0,
            }));
            g.lines.push({
                variantId, variantSku: m.sku, variantName: m.name,
                zoneId: null, binId: null, zoneCode: null, binCode: null, bookQty,
            });
            continue;
        }
        if (!binds.length) {
            const g = ensureGroup('unassigned', () => ({
                scopeType: 'unassigned', zoneId: null, zoneCode: null, zoneName: null, expectedCount: 0,
            }));
            g.lines.push({
                variantId, variantSku: m.sku, variantName: m.name,
                zoneId: null, binId: null, zoneCode: null, binCode: null, bookQty,
            });
            continue;
        }
        for (const b of binds) {
            const zm = zoneMeta.get(b.zoneId);
            const g = ensureGroup(`zone:${b.zoneId}`, () => {
                var _a, _b, _c;
                return ({
                    scopeType: 'zone',
                    zoneId: b.zoneId,
                    zoneCode: (_b = (_a = b.zoneCode) !== null && _a !== void 0 ? _a : zm === null || zm === void 0 ? void 0 : zm.code) !== null && _b !== void 0 ? _b : null,
                    zoneName: (_c = zm === null || zm === void 0 ? void 0 : zm.name) !== null && _c !== void 0 ? _c : null,
                    expectedCount: 0,
                });
            });
            g.lines.push({
                variantId, variantSku: m.sku, variantName: m.name,
                zoneId: b.zoneId, binId: b.binId,
                zoneCode: (_b = (_a = b.zoneCode) !== null && _a !== void 0 ? _a : zm === null || zm === void 0 ? void 0 : zm.code) !== null && _b !== void 0 ? _b : null, binCode: (_c = b.binCode) !== null && _c !== void 0 ? _c : null,
                bookQty,
            });
        }
    }
    const keys = Array.from(groups.keys()).sort((a, b) => {
        const rank = (k) => (k === 'whole' ? 0 : k === 'unassigned' ? 2 : 1);
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb)
            return ra - rb;
        const na = Number(a.split(':')[1] || 0);
        const nb = Number(b.split(':')[1] || 0);
        return na - nb;
    });
    const waves = [];
    const linesByWave = [];
    for (const key of keys) {
        const g = groups.get(key);
        g.wave.expectedCount = g.lines.length;
        waves.push(g.wave);
        linesByWave.push(g.lines);
    }
    return { waves, linesByWave };
}
/** 非盘盈行的账面快照（同变体各行相同，取首个） */
function variantSnapBook(lines) {
    const m = new Map();
    for (const l of lines) {
        if (l.isExtra)
            continue;
        if (!m.has(l.variantId))
            m.set(l.variantId, l.bookQty);
    }
    return m;
}
/**
 * 差异汇总（规格 §6.2）：**以变体为最小比对单位**。
 * 实盘合计 = SUM(countedQty)（含盘盈行，未盘行不计入）；盈亏 = 实盘合计 - 当前账面。
 */
function summarizeVariance(lines, currentBook, currentBind) {
    var _a, _b, _c, _d, _e, _f;
    const bookMap = new Map();
    for (const r of currentBook)
        bookMap.set(r.variantId, (bookMap.get(r.variantId) || 0) + (r.quantity || 0));
    const bindMap = new Map();
    for (const b of currentBind)
        bindMap.set(b.variantId, b);
    const snap = variantSnapBook(lines);
    const grouped = new Map();
    for (const l of lines) {
        const list = grouped.get(l.variantId) || [];
        list.push(l);
        grouped.set(l.variantId, list);
    }
    const uncountedLineIds = [];
    const extraLineIds = [];
    const byVariant = [];
    const changedVariants = [];
    for (const l of lines) {
        if (l.isExtra)
            extraLineIds.push(l.id);
        else if (l.countedQty === null)
            uncountedLineIds.push(l.id);
    }
    for (const variantId of Array.from(grouped.keys()).sort((a, b) => a - b)) {
        const rows = grouped.get(variantId);
        const countedTotal = rows.reduce((s, l) => s + (l.countedQty === null ? 0 : l.countedQty), 0);
        const currentBookQty = bookMap.get(variantId) || 0;
        const snapBookQty = snap.get(variantId) || 0;
        const diff = countedTotal - currentBookQty;
        // 目标库位 = 最后一条「已盘且带库位」的行
        const located = rows.filter((l) => l.countedQty !== null && (l.zoneId !== null || l.binId !== null));
        const target = located.length ? located[located.length - 1] : null;
        const cur = bindMap.get(variantId) || null;
        const binChanged = !!target && (!cur ||
            ((_a = cur.zoneId) !== null && _a !== void 0 ? _a : null) !== ((_b = target.zoneId) !== null && _b !== void 0 ? _b : null) ||
            ((_c = cur.binId) !== null && _c !== void 0 ? _c : null) !== ((_d = target.binId) !== null && _d !== void 0 ? _d : null));
        const isExtra = rows.every((l) => l.isExtra);
        if (diff !== 0 || binChanged || isExtra) {
            byVariant.push({
                variantId, countedTotal, bookQty: currentBookQty, snapBookQty, diff, isExtra, binChanged,
                targetZoneId: target ? (_e = target.zoneId) !== null && _e !== void 0 ? _e : null : null,
                targetBinId: target ? (_f = target.binId) !== null && _f !== void 0 ? _f : null : null,
            });
        }
        if (currentBookQty !== snapBookQty) {
            changedVariants.push({ variantId, snapBookQty, currentBookQty });
        }
    }
    return {
        expectedTotal: lines.filter((l) => !l.isExtra).length,
        countedLineCount: lines.filter((l) => !l.isExtra && l.countedQty !== null).length,
        uncountedCount: uncountedLineIds.length,
        extraCount: extraLineIds.length,
        byVariant,
        uncountedLineIds,
        extraLineIds,
        changedVariants,
        recheck: changedVariants.length > 0,
    };
}
/**
 * 过账项（规格 §6.3 步骤 5）：
 * - 有差异 → realQty = 实盘合计
 * - 无差异但库位变更 → realQty = 当前账面（仅触发原地归位，不动数量）
 * - 两者都不是 → 不生成项
 */
function buildPostItems(input) {
    const { summary, stockLocationId } = input;
    const items = [];
    for (const v of summary.byVariant) {
        if (v.diff === 0 && !v.binChanged)
            continue;
        items.push({
            variantId: v.variantId,
            toStockLocationId: stockLocationId,
            realQty: v.diff === 0 ? v.bookQty : v.countedTotal,
            zoneId: v.targetZoneId,
            binId: v.targetBinId,
        });
    }
    return { items };
}
// ---------------------------------------------------------------- 状态派生与独占锁
/** 录入后盘次状态：有实盘即 COUNTING；终态不回退（幂等保护） */
function resolveWaveStateAfterCount(current, countedCount) {
    if (current === 'SUBMITTED' || current === 'CANCELLED')
        return current;
    return countedCount > 0 ? 'COUNTING' : current;
}
/** 盘次集合变化后任务状态：全部 SUBMITTED/CANCELLED → COUNTED；否则（已有盘次）COUNTING */
function resolveTaskStateAfterWaves(current, waves) {
    if (current === 'POSTED' || current === 'CANCELLED')
        return current;
    if (!waves.length)
        return current === 'DRAFT' ? 'DRAFT' : current;
    const allDone = waves.every((w) => w.state === 'SUBMITTED' || w.state === 'CANCELLED');
    return allDone ? 'COUNTED' : 'COUNTING';
}
/** 盘次独占校验（规格 §3.6）：非负责人/未认领一律拒绝并回传原因 */
function waveOwnerError(assigneeId, operatorId, assigneeName) {
    if (!assigneeId)
        return '该盘次尚未认领，请先认领后再操作';
    if (String(assigneeId) !== String(operatorId)) {
        return `该盘次已被 ${assigneeName || '其他人员'} 认领，无法操作`;
    }
    return null;
}
/**
 * 扫码解析优先级（规格 §8.3）：库位码 → 内部码 → 条形码 → SKU → 未命中。
 * 命中的永远是「任务内应盘行」优先，其次才是清单外变体（避免把清单内变体误登记为盘盈）。
 */
function resolveScanCode(raw, ctx) {
    const code = (raw || '').trim();
    if (!code)
        return { kind: 'none', raw: '' };
    const bin = ctx.bins.find((b) => b.binCode === code);
    if (bin)
        return { kind: 'bin', binId: bin.binId, binCode: bin.binCode, zoneId: bin.zoneId };
    const hitLine = (v) => v.internalCode === code || v.barcode === code || v.sku === code;
    const line = ctx.lines.find(hitLine);
    if (line)
        return { kind: 'line', lineId: line.lineId, variantId: line.variantId };
    const variant = ctx.variants.find(hitLine);
    if (variant)
        return { kind: 'extra', variantId: variant.variantId, sku: variant.sku, name: variant.name };
    return { kind: 'none', raw: code };
}
//# sourceMappingURL=stocktake-math.js.map