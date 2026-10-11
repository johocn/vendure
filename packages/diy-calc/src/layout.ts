import { mulberry32 } from './prng';

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

function pickWeighted(palette: string[], weights: number[], rng: () => number, history: string[]): string {
    // 同材质连续已达 3 颗时禁选；候选全被禁则退化为无约束
    const banned = history.length === 3 && history.every(m => m === history[0]) ? history[0] : null;
    const pool: string[] = [];
    const wpool: number[] = [];
    for (let i = 0; i < palette.length; i++) {
        if (palette[i] === banned) continue;
        pool.push(palette[i]);
        wpool.push(weights[i]);
    }
    const pickFrom = pool.length ? pool : palette;
    const pickW = pool.length ? wpool : weights;
    const total = pickW.reduce((s, w) => s + w, 0);
    let roll = rng() * total;
    let picked = pickFrom[pickFrom.length - 1];
    for (let i = 0; i < pickFrom.length; i++) {
        roll -= pickW[i];
        if (roll <= 0) {
            picked = pickFrom[i];
            break;
        }
    }
    history.push(picked);
    if (history.length > 3) history.shift();
    return picked;
}

/**
 * 确定性排布（§7.5）：
 * - angle = (index/count)·2π；depth = 0.5 + 0.5·sin(angle)（下半圈朝前）
 * - rotation = mulberry32(seed ^ (index·0x9E3779B1))·2π
 * - random 用独立随机流 mulberry32(seed ^ 0x51ED270B) 轮盘赌 + 连续同色约束
 * - 输出先按 angle 再按 depth 排，保证渲染稳定
 */
export function buildLayout(input: LayoutInput): { beads: LayoutBead[] } {
    const { count, seed, pattern, materials } = input;
    const every = Math.max(0, Math.floor(input.spacerEvery ?? 0));
    const ratio = Math.max(1, Math.floor(input.ratio ?? 1));
    const randomRng = mulberry32((seed ^ 0x51ed270b) | 0);
    const history: string[] = [];
    const beads: LayoutBead[] = [];

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        let materialId = materials.main ?? '';
        let role: LayoutBead['role'] = 'main';

        const isSpacer = every > 0 && !!materials.spacer && (i + 1) % (every + 1) === 0;
        if (pattern === 'focal' && i === 0 && materials.focal) {
            materialId = materials.focal;
        } else if (isSpacer) {
            materialId = materials.spacer!;
            role = 'spacer';
        } else {
            switch (pattern) {
                case 'ab': {
                    const a = materials.main ?? '';
                    const b = materials.secondary ?? a;
                    materialId = i % (ratio + 1) < ratio ? a : b;
                    break;
                }
                case 'gradient': {
                    const palette =
                        input.palette && input.palette.length >= 2
                            ? input.palette
                            : [materials.main ?? '', materials.secondary ?? ''];
                    const half = Math.floor(count / 2);
                    const dist = Math.min(i, count - 1 - i);
                    const t = half === 0 ? 0 : dist / half;
                    const gi = Math.min(palette.length - 1, Math.floor(t * palette.length));
                    materialId = palette[gi];
                    role = 'secondary';
                    break;
                }
                case 'random': {
                    const palette = input.palette && input.palette.length ? input.palette : [materials.main ?? ''];
                    const weights =
                        input.weights && input.weights.length === palette.length ? input.weights : palette.map(() => 1);
                    materialId = pickWeighted(palette, weights, randomRng, history);
                    break;
                }
                case 'solid':
                case 'focal':
                default:
                    materialId = materials.main ?? '';
                    break;
            }
        }

        beads.push({
            index: i,
            angle,
            depth: 0.5 + 0.5 * Math.sin(angle),
            materialId,
            rotation: mulberry32(seed ^ (i * 0x9e3779b1))() * 2 * Math.PI,
            role,
        });
    }

    beads.sort((a, b) => a.angle - b.angle || a.depth - b.depth);
    return { beads };
}
