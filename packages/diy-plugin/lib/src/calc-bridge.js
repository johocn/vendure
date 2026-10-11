"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDiyCalc = runDiyCalc;
exports.toPlanBom = toPlanBom;
const calc_1 = require("@diy/calc");
const localize_1 = require("./localize");
const template_config_1 = require("./template-config");
/**
 * 复算桥（规格 §6.2/§6.3，双端同构核心）：
 * spec.slots（slotKey → 选择）+ 合并素材 → @diy/calc CalculatorInput → CalculatorOutput。
 * 抛错语义：模板 config 非法 / slot 键不存在 / 引用素材不在合并视图 —— 调用方（service）转 UserInputError。
 * languageCode 传 Vendure 原生码（如 zh_Hans），内部经 resolveLocaleKey 映射 jsonb 键。
 */
function runDiyCalc(template, spec, materials, languageCode) {
    const config = (0, template_config_1.parseTemplateConfig)(template.config);
    if (!config) {
        throw new Error(`Invalid template config`);
    }
    const keyToRole = new Map(config.slots.map(s => [s.key, s.role]));
    const materialsById = new Map(materials.map(m => [String(m.id), m]));
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
    const input = { params: spec.params, slots, materials: calcMaterials };
    return (0, calc_1.getCalculator)(template.calculatorKey)(input);
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