"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSV_MAX_ROWS = exports.WAVE_STATES = exports.TASK_STATES = void 0;
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
exports.parseStateFilter = parseStateFilter;
exports.aggregateByBin = aggregateByBin;
exports.aggregateByCounter = aggregateByCounter;
exports.toCsv = toCsv;
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
 * - autoSplitByZone=false（且 binMode≠off）→ 只建一个 whole 盘次，行保留库位归属
 */
function buildExpected(input) {
    var _a, _b, _c, _d, _e, _f;
    const { binMode, bookRows, bindRows, variantMeta, zoneMeta, scope } = input;
    const autoSplit = input.autoSplitByZone !== false;
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
        // 不按库区拆盘次：整仓一个盘次；行仍按绑定保留库位（含未绑定行），供录入页网格/未归位桶使用
        if (!autoSplit) {
            const g = ensureGroup('whole', () => ({
                scopeType: 'whole', zoneId: null, zoneCode: null, zoneName: null, expectedCount: 0,
            }));
            if (!binds.length) {
                g.lines.push({
                    variantId, variantSku: m.sku, variantName: m.name,
                    zoneId: null, binId: null, zoneCode: null, binCode: null, bookQty,
                });
                continue;
            }
            for (const b of binds) {
                const zm = zoneMeta.get(b.zoneId);
                g.lines.push({
                    variantId, variantSku: m.sku, variantName: m.name,
                    zoneId: b.zoneId, binId: b.binId,
                    zoneCode: (_b = (_a = b.zoneCode) !== null && _a !== void 0 ? _a : zm === null || zm === void 0 ? void 0 : zm.code) !== null && _b !== void 0 ? _b : null, binCode: (_c = b.binCode) !== null && _c !== void 0 ? _c : null, bookQty,
                });
            }
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
                zoneCode: (_e = (_d = b.zoneCode) !== null && _d !== void 0 ? _d : zm === null || zm === void 0 ? void 0 : zm.code) !== null && _e !== void 0 ? _e : null, binCode: (_f = b.binCode) !== null && _f !== void 0 ? _f : null,
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
 * **整变体未盘（该变体所有行 countedQty 均为 null）→ 不进 byVariant（过账时账面保持不变）；
 * 未盘行仍由 uncountedLineIds / uncountedCount 列出。**
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
        // 整变体未盘 → 真跳过（不生成差异/过账项，账面保持不变）；有盘盈行即 hasCounted=true
        const hasCounted = rows.some((l) => l.countedQty !== null);
        if (hasCounted && (diff !== 0 || binChanged || isExtra)) {
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
 * 未盘变体不出现在 summary.byVariant 中，因此天然不会进入过账计划（过账只覆盖有差异 / 仅库位变更的变体）。
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
/**
 * 列表状态过滤解析（规格 §7.1）：state（单值）优先 → states（多值）→ 都为空则不过滤。
 * 优先级必须写单测锁住：前端「已结束」页签只下发 states，历史调用方只下发 state。
 */
function parseStateFilter(options) {
    const one = (options === null || options === void 0 ? void 0 : options.state) ? String(options.state).trim() : '';
    if (one)
        return { mode: 'one', values: [one] };
    const many = ((options === null || options === void 0 ? void 0 : options.states) || []).map((s) => String(s || '').trim()).filter(Boolean);
    if (many.length)
        return { mode: 'many', values: many };
    return { mode: 'none', values: [] };
}
/**
 * 按库位聚合（规格 §7.3）：只出作业量，不出任何差异数量/金额
 * （差异是变体口径，摊到库位会重复计数 —— 规格 §3.3）。
 */
function aggregateByBin(lines) {
    var _a, _b;
    const groups = new Map();
    for (const l of lines) {
        const key = `${(_a = l.zoneId) !== null && _a !== void 0 ? _a : ''}|${(_b = l.binId) !== null && _b !== void 0 ? _b : ''}`;
        let g = groups.get(key);
        if (!g) {
            g = {
                zoneId: l.zoneId, zoneCode: l.zoneCode, binId: l.binId, binCode: l.binCode,
                expectedLines: 0, countedLines: 0, uncountedLines: 0, extraLines: 0,
            };
            groups.set(key, g);
        }
        if (l.zoneCode && !g.zoneCode)
            g.zoneCode = l.zoneCode;
        if (l.binCode && !g.binCode)
            g.binCode = l.binCode;
        if (l.isExtra) {
            g.extraLines += 1;
            continue;
        }
        g.expectedLines += 1;
        if (l.countedQty !== null)
            g.countedLines += 1;
        else
            g.uncountedLines += 1;
    }
    const byName = (a, b) => String(a !== null && a !== void 0 ? a : '~').localeCompare(String(b !== null && b !== void 0 ? b : '~'));
    return Array.from(groups.values()).sort((a, b) => {
        // 未归位组（zoneId/binId 皆空）置末，其余按 zoneCode → binCode 升序
        const aOrphan = a.zoneId === null && a.binId === null ? 1 : 0;
        const bOrphan = b.zoneId === null && b.binId === null ? 1 : 0;
        if (aOrphan !== bOrphan)
            return aOrphan - bOrphan;
        return byName(a.zoneCode, b.zoneCode) || byName(a.binCode, b.binCode);
    });
}
/** 按盘点人聚合（规格 §7.3）：只统计「确实被盘过」的行（含盘盈行）。 */
function aggregateByCounter(lines) {
    var _a;
    const groups = new Map();
    for (const l of lines) {
        if (l.countedQty === null)
            continue;
        const key = (_a = l.countedById) !== null && _a !== void 0 ? _a : '';
        let g = groups.get(key);
        if (!g) {
            g = {
                countedById: l.countedById, countedByName: l.countedByName,
                countedLines: 0, extraLines: 0, waveCount: 0, lastCountedAt: null, waves: new Set(),
            };
            groups.set(key, g);
        }
        if (l.countedByName && !g.countedByName)
            g.countedByName = l.countedByName;
        g.countedLines += 1;
        if (l.isExtra)
            g.extraLines += 1;
        g.waves.add(l.waveId);
        if (l.countedAt && (!g.lastCountedAt || l.countedAt > g.lastCountedAt))
            g.lastCountedAt = l.countedAt;
    }
    return Array.from(groups.values())
        .map((_a) => {
        var { waves } = _a, rest = __rest(_a, ["waves"]);
        return (Object.assign(Object.assign({}, rest), { waveCount: waves.size }));
    })
        .sort((a, b) => { var _a, _b; return b.countedLines - a.countedLines || String((_a = a.countedByName) !== null && _a !== void 0 ? _a : '').localeCompare(String((_b = b.countedByName) !== null && _b !== void 0 ? _b : '')); });
}
/** 导出行数上限（规格 §7.4）：超出即截断并置 truncated=true */
exports.CSV_MAX_ROWS = 20000;
/**
 * CSV 序列化（规格 §7.4，前后端同一规则）：
 * ① 首字符 BOM（Excel 中文不乱码）② 行尾 CRLF ③ 含 , " \n \r 时整体引号包裹、内部 " 翻倍
 * ④ null/undefined → 空字段；boolean → 是/否；Date → ISO ⑤ 行数上限截断。
 */
function toCsv(rows, maxRows = exports.CSV_MAX_ROWS) {
    const cell = (v) => {
        if (v === null || v === undefined)
            return '';
        if (typeof v === 'boolean')
            return v ? '是' : '否';
        if (v instanceof Date)
            return v.toISOString();
        const s = String(v);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '\uFEFF' + rows.slice(0, maxRows).map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
//# sourceMappingURL=stocktake-math.js.map