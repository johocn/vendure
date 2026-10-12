import { DiyPlanBom, DiyPlanSpec } from './types';

/** 画廊封面素材 id：优先 spec.slotList（v2 数组槽位），回退 spec.slots 对象；去重取前 3 */
export function coverMaterialIds(spec: DiyPlanSpec | null | undefined): string[] {
    const seen = new Set<string>();
    const fromList = Array.isArray(spec?.slotList) ? spec!.slotList! : [];
    for (const slot of fromList) {
        if (slot?.materialId) {
            seen.add(String(slot.materialId));
        }
        if (seen.size >= 3) {
            return [...seen];
        }
    }
    for (const slot of Object.values(spec?.slots ?? {})) {
        if (slot?.materialId) {
            seen.add(slot.materialId);
        }
        if (seen.size >= 3) {
            break;
        }
    }
    return [...seen];
}

/**
 * 画廊/公开页标题派生：bom 快照素材名（创建时已本地化）去重串联 + 手围 cm，
 * 如「南红青金 · 16cm」；无 bom/无素材名回退「DIY 方案」；手围缺失则只出素材名段。
 */
export function derivePlanTitle(spec: DiyPlanSpec | null | undefined, bom: DiyPlanBom | null | undefined): string {
    const names: string[] = [];
    for (const item of bom?.items ?? []) {
        if (item.name && !names.includes(item.name)) {
            names.push(item.name);
        }
        if (names.length >= 2) {
            break;
        }
    }
    if (names.length === 0) {
        return 'DIY 方案';
    }
    const wristSize = Number(spec?.params?.wristSize ?? 0);
    const suffix = wristSize > 0 ? ` · ${Math.round(wristSize / 10)}cm` : '';
    return names.join(' + ') + suffix;
}

/**
 * 渲染预设推断（populate 脚本与素材导入共用）。按素材名关键词匹配，
 * 顺序敏感：翡翠（无「玉」字）先于玉系、青金先于金属（「金」字冲突）。
 */
export function inferRenderPreset(name: string): string {
    const n = String(name ?? '');
    if (n.includes('翡翠')) {
        return 'jade-flower';
    }
    if (n.includes('玉')) {
        return 'jade';
    }
    if (n.includes('琉璃') || n.includes('玻璃') || n.includes('水晶')) {
        return 'glass';
    }
    if (n.includes('蜜蜡') || n.includes('琥珀')) {
        return 'amber';
    }
    if (n.includes('珍珠')) {
        return 'pearl';
    }
    if (n.includes('南红') || n.includes('玛瑙') || n.includes('青金') || n.includes('砭石')) {
        return 'matte';
    }
    // wood 先于 metal：金刚菩提/菩提根等含「金/木」字样，避免被金属规则截胡
    if (n.includes('椰壳') || n.includes('木') || n.includes('菩提') || n.includes('竹')) {
        return 'wood';
    }
    if (/金|银|铜|k$/i.test(n)) {
        return 'metal';
    }
    return 'matte';
}
