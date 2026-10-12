import { CalcBomItem, CalcMaterial } from './types';

/** 弹力线打结收尾留量（§7.6） */
export const CORD_TAIL = 160;
/** 线径可选档（mm），按最小孔径从大到小取 */
export const CORD_DIAMETERS = [1.0, 0.8, 0.6];

export function specOf(m: CalcMaterial): string {
    return m.diameter != null ? `${m.diameter}mm ${m.shape}` : m.shape;
}

export function bomItem(m: CalcMaterial, qty: number): CalcBomItem {
    return {
        materialId: m.id,
        code: m.code,
        name: m.name,
        spec: specOf(m),
        unitPrice: m.price,
        qty,
        subtotal: qty * m.price,
    };
}

export function aggregate(items: CalcBomItem[]): CalcBomItem[] {
    const map = new Map<string, CalcBomItem>();
    for (const item of items) {
        const existing = map.get(item.materialId);
        if (existing) {
            existing.qty += item.qty;
            existing.subtotal += item.subtotal;
        } else {
            map.set(item.materialId, { ...item });
        }
    }
    return [...map.values()];
}

export function pickCordDiameter(holeMin: number | null): number {
    if (holeMin == null) {
        return 1.0;
    }
    const max = Math.min(holeMin - 0.2, 1.0);
    return CORD_DIAMETERS.find(d => d <= max) ?? 0.6;
}
