"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDiyCalc = runDiyCalc;
exports.toPlanBom = toPlanBom;
const calc_1 = require("@diy/calc");
const localize_1 = require("./localize");
const template_config_1 = require("./template-config");
/**
 * 复算桥（规格 §6.2/§6.3，双端同构核心）：
 * - v2 路径（spec.slotList 非空）：数组槽位（多主珠/多隔片/decor）→
 *   有 sequence 走 sequenceGeometry（自由/规律序列，前端 seeded 生成保证可复现），
 *   否则走 braceletCalculator v2 多槽位收敛路径；
 * - v1 路径（仅 spec.slots 对象）：slotKey → 选择 + 模板 config keyToRole，存量方案零回归。
 * 抛错语义：模板 config 非法 / slot 键不存在 / 引用素材不在合并视图 —— 调用方（service）转 UserInputError。
 * languageCode 传 Vendure 原生码（如 zh_Hans），内部经 resolveLocaleKey 映射 jsonb 键。
 */
function runDiyCalc(template, spec, materials, languageCode) {
    var _a, _b, _c, _d;
    const config = (0, template_config_1.parseTemplateConfig)(template.config);
    if (!config) {
        throw new Error(`Invalid template config`);
    }
    const materialsById = new Map(materials.map(m => [String(m.id), m]));
    const localeKey = (0, localize_1.resolveLocaleKey)(languageCode);
    const calcMaterials = materials.map(m => ({
        id: String(m.id),
        code: m.code,
        name: (0, localize_1.localizeText)(m.name, localeKey, m.code),
        shape: m.shape,
        diameter: m.diameter,
        axialLength: m.axialLength,
        holeSize: m.holeSize,
        price: m.price,
    }));
    const inputOf = (slots) => ({
        params: spec.params,
        slots,
        materials: calcMaterials,
    });
    // v2 数组槽位路径
    const slotList = Array.isArray(spec.slotList) ? spec.slotList : [];
    if (slotList.length > 0) {
        const slots = slotList.map((s, i) => {
            if (!materialsById.has(String(s.materialId))) {
                throw new Error(`Slot "${s.role}" material ${s.materialId} not found`);
            }
            return {
                key: `${s.role}-${i}`,
                role: s.role,
                materialId: String(s.materialId),
                qtyOverride: s.qtyOverride,
                every: s.every,
                arrange: s.arrange,
            };
        });
        const sequence = ((_a = spec.sequence) !== null && _a !== void 0 ? _a : []).map(String).filter(id => materialsById.has(id));
        if (sequence.length > 0) {
            const wristSize = Number((_b = spec.params.wristSize) !== null && _b !== void 0 ? _b : 155);
            const gap = Number((_c = spec.params.gap) !== null && _c !== void 0 ? _c : 0.5);
            const ease = (0, calc_1.easeOf)(String((_d = spec.params.fit) !== null && _d !== void 0 ? _d : 'comfortable'));
            const decorSlots = slots.filter(s => s.role === 'decor');
            return (0, calc_1.sequenceGeometry)(sequence, calcMaterials, gap, wristSize, ease, decorSlots);
        }
        return (0, calc_1.getCalculator)(template.calculatorKey)(inputOf(slots));
    }
    // v1 对象槽位路径（存量方案零回归）
    const keyToRole = new Map(config.slots.map(s => [s.key, s.role]));
    const slots = [];
    for (const [key, sel] of Object.entries(spec.slots)) {
        const role = keyToRole.get(key);
        if (!role) {
            throw new Error(`Unknown slot "${key}"`);
        }
        const material = materialsById.get(String(sel.materialId));
        if (!material) {
            throw new Error(`Slot "${key}" material ${sel.materialId} not found`);
        }
        slots.push({
            key,
            role,
            materialId: String(sel.materialId),
            qtyOverride: sel.qtyOverride,
            every: sel.every,
        });
    }
    return (0, calc_1.getCalculator)(template.calculatorKey)(inputOf(slots));
}
/** CalcBom（cord/geometry 可为 null）→ DiyPlanBom（可选字段），落库前规范化 */
function toPlanBom(bom) {
    var _a, _b;
    return {
        items: bom.items,
        totalCount: bom.totalCount,
        totalAmount: bom.totalAmount,
        cord: (_a = bom.cord) !== null && _a !== void 0 ? _a : undefined,
        geometry: (_b = bom.geometry) !== null && _b !== void 0 ? _b : undefined,
    };
}
//# sourceMappingURL=calc-bridge.js.map