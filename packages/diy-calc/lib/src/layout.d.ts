export interface LayoutBead {
    index: number;
    /** 椭圆参数角（rad） */
    angle: number;
    /** 深度 0~1，1 = 最靠近观察者（前半圈） */
    depth: number;
    materialId: string;
    /** 纹理旋转（rad），来自按珠序派生的确定性伪随机，避免整圈纹理重复 */
    rotation: number;
    role: 'main' | 'secondary' | 'spacer';
}
export type LayoutPattern = 'solid' | 'ab' | 'gradient' | 'random' | 'focal';
export interface LayoutInput {
    count: number;
    seed: number;
    pattern: LayoutPattern;
    materials: {
        main?: string;
        secondary?: string;
        focal?: string;
        spacer?: string;
    };
    /** ab：A 连续颗数（周期 [A×ratio, B]，默认 1 = 纯交替） */
    ratio?: number;
    /** gradient：深→浅素材序列（≥2）；random：候选池 */
    palette?: string[];
    /** random：与 palette 对齐的轮盘赌权重 */
    weights?: number[];
    /** 隔片插入周期：每隔几颗插一片（0/缺省 = 不插） */
    spacerEvery?: number;
}
/**
 * 确定性排布（§7.5）：
 * - angle = (index/count)·2π；depth = 0.5 + 0.5·sin(angle)（下半圈朝前）
 * - rotation = mulberry32(seed ^ (index·0x9E3779B1))·2π
 * - random 用独立随机流 mulberry32(seed ^ 0x51ED270B) 轮盘赌 + 连续同色约束
 * - 输出先按 angle 再按 depth 排，保证渲染稳定
 */
export declare function buildLayout(input: LayoutInput): {
    beads: LayoutBead[];
};
