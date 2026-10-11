import { CalcBom, CalcMaterial, CalculatorInput, CalculatorOutput, SlotSelection, getCalculator } from '@diy/calc';

import { localizeText, resolveLocaleKey } from './localize';
import { parseTemplateConfig } from './template-config';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyPlanBom, DiyPlanSpec } from './types';

/**
 * 复算桥（规格 §6.2/§6.3，双端同构核心）：
 * spec.slots（slotKey → 选择）+ 合并素材 → @diy/calc CalculatorInput → CalculatorOutput。
 * 抛错语义：模板 config 非法 / slot 键不存在 / 引用素材不在合并视图 —— 调用方（service）转 UserInputError。
 * languageCode 传 Vendure 原生码（如 zh_Hans），内部经 resolveLocaleKey 映射 jsonb 键。
 */
export function runDiyCalc(
    template: Pick<DiyTemplate, 'calculatorKey' | 'config'>,
    spec: DiyPlanSpec,
    materials: DiyMaterial[],
    languageCode: string,
): CalculatorOutput {
    const config = parseTemplateConfig(template.config);
    if (!config) {
        throw new Error(`Invalid template config`);
    }
    const keyToRole = new Map(config.slots.map(s => [s.key, s.role]));
    const materialsById = new Map(materials.map(m => [String(m.id), m]));
    const slots: SlotSelection[] = [];
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
    const localeKey = resolveLocaleKey(languageCode);
    const calcMaterials: CalcMaterial[] = materials.map(m => ({
        id: String(m.id),
        code: m.code,
        name: localizeText(m.name, localeKey, m.code),
        shape: m.shape,
        diameter: m.diameter,
        axialLength: m.axialLength,
        holeSize: m.holeSize,
        price: m.price,
    }));
    const input: CalculatorInput = { params: spec.params, slots, materials: calcMaterials };
    return getCalculator(template.calculatorKey)(input);
}

/** CalcBom（cord/geometry 可为 null）→ DiyPlanBom（可选字段），落库前规范化 */
export function toPlanBom(bom: CalcBom): DiyPlanBom {
    return {
        items: bom.items,
        totalCount: bom.totalCount,
        totalAmount: bom.totalAmount,
        cord: bom.cord ?? undefined,
        geometry: bom.geometry ?? undefined,
    };
}
