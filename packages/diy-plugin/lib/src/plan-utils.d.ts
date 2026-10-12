import { DiyPlanBom, DiyPlanSpec } from './types';
/** 画廊封面素材 id：spec.slots 的 materialId 去重取前 3 */
export declare function coverMaterialIds(spec: DiyPlanSpec | null | undefined): string[];
/**
 * 画廊/公开页标题派生：bom 快照素材名（创建时已本地化）去重串联 + 手围 cm，
 * 如「南红青金 · 16cm」；无 bom/无素材名回退「DIY 方案」；手围缺失则只出素材名段。
 */
export declare function derivePlanTitle(spec: DiyPlanSpec | null | undefined, bom: DiyPlanBom | null | undefined): string;
/**
 * 渲染预设推断（populate 脚本与素材导入共用）。按素材名关键词匹配，
 * 顺序敏感：翡翠（无「玉」字）先于玉系、青金先于金属（「金」字冲突）。
 */
export declare function inferRenderPreset(name: string): string;
