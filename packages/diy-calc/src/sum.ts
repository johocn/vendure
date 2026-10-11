import { CalcBom, CalcBomItem, Calculator, CalcMaterial } from './types';

/**
 * 内置 sum 计算器：BOM = Σ 槽位素材 × 数量。
 * 选择型玩法（如汽车模型延后接入）零代码即用；calculatorKey 为 null/未知时的兜底。
 */
export function buildSumBom(
    slots: { materialId?: string; qtyOverride?: number }[],
    materials: CalcMaterial[],
): CalcBom {
    const byId = new Map(materials.map(m => [m.id, m]));
    const items: CalcBomItem[] = [];
    for (const slot of slots) {
        if (!slot.materialId) continue;
        const m = byId.get(slot.materialId);
        if (!m) continue;
        const qty = Math.max(0, Math.floor(slot.qtyOverride ?? 1));
        if (qty === 0) continue;
        const existing = items.find(i => i.materialId === m.id);
        if (existing) {
            existing.qty += qty;
            existing.subtotal += qty * m.price;
            continue;
        }
        items.push({
            materialId: m.id,
            code: m.code,
            name: m.name,
            spec: m.diameter != null ? `${m.diameter}mm ${m.shape}` : m.shape,
            unitPrice: m.price,
            qty,
            subtotal: qty * m.price,
        });
    }
    return {
        items,
        totalCount: items.reduce((s, i) => s + i.qty, 0),
        totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
        cord: null,
        geometry: null,
    };
}

export const sumCalculator: Calculator = input => ({
    calc: null,
    bom: buildSumBom(input.slots, input.materials),
});
