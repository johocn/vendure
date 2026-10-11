import { FitFeedback } from './types';

/** 颗数上下限（§7.2）：超出说明参数组合不合理 */
export const MIN_COUNT = 8;
export const MAX_COUNT = 120;

/** fit → 体感松量 ease（mm）：贴手 4 / 舒适 10 / 宽松 20（§7.1） */
export function easeOf(fit: string): number {
    switch (fit) {
        case 'snug':
            return 4;
        case 'loose':
            return 20;
        default:
            return 10;
    }
}

/** 单颗节距对应中心角（弦长近似，rad）：θ = 2·asin(pitch / (2R)) */
export function angleOf(pitch: number, R: number): number {
    return 2 * Math.asin(pitch / (2 * R));
}

/** N 颗节距 pitch 的珠连成正 N 边形后的内孔周长（mm）：π·pitch/sin(π/N) − π·d */
export function innerCircOf(n: number, pitch: number, d: number): number {
    return (Math.PI * pitch) / Math.sin(Math.PI / n) - Math.PI * d;
}

/** 相对手围余量的反馈分级（§7.1 ⑦） */
export function feedbackOf(clearance: number): FitFeedback {
    if (clearance < 0) return 'too-tight';
    if (clearance < 4) return 'snug';
    if (clearance < 12) return 'ok';
    if (clearance < 25) return 'loose';
    return 'too-loose';
}

export interface BraceletGeometry {
    count: number;
    countInitial: number;
    centerCircumference: number;
    innerCircumference: number;
    feedback: FitFeedback;
    clearance: number;
    adjustHint: { delta: number; feedback: FitFeedback }[];
}

/**
 * 手串几何主算（§7.1 + §7.2）：
 * - pitch = 轴长 + gap（算量用轴向长度，不是直径）
 * - L_center = W + ease + π·d（内径修正项——漏掉它珠子会全部偏少，手串戴不上）
 * - countInitial = floor(2π/θ)；count = pickBestCount 收敛值
 * - centerCircumference = 收敛后实际中心线周长 π·pitch/sin(π/count)
 */
export function computeBraceletGeometry(input: {
    wristSize: number;
    diameter: number;
    axialLength: number;
    gap: number;
    ease: number;
}): BraceletGeometry {
    const { wristSize: W, diameter: d, axialLength: t, gap, ease } = input;
    const pitch = t + gap;
    const LCenter = W + ease + Math.PI * d;
    const R = LCenter / (2 * Math.PI);
    const theta = angleOf(pitch, R);
    const countInitial = Math.floor((2 * Math.PI) / theta);
    const count = pickBestCount(W, d, pitch, countInitial);
    const centerCircumference = (Math.PI * pitch) / Math.sin(Math.PI / count);
    const innerCircumference = innerCircOf(count, pitch, d);
    const clearance = innerCircumference - W;
    const adjustHint: BraceletGeometry['adjustHint'] = [];
    if (count + 1 <= MAX_COUNT) {
        adjustHint.push({ delta: 1, feedback: feedbackOf(innerCircOf(count + 1, pitch, d) - W) });
    }
    if (count - 1 >= MIN_COUNT) {
        adjustHint.push({ delta: -1, feedback: feedbackOf(innerCircOf(count - 1, pitch, d) - W) });
    }
    return {
        count,
        countInitial,
        centerCircumference,
        innerCircumference,
        feedback: feedbackOf(clearance),
        clearance,
        adjustHint,
    };
}

/** §7.2 收敛：innerCirc(n) − W 落入 [4, 25)；兜不住手腕先加、过松则减 */
export function pickBestCount(W: number, d: number, pitch: number, n0: number): number {
    const innerOf = (n: number) => innerCircOf(n, pitch, d);
    let n = Math.min(Math.max(n0, MIN_COUNT), MAX_COUNT);
    while (n < MAX_COUNT && innerOf(n) < W + 4) n++;
    while (n > MIN_COUNT && innerOf(n - 1) >= W + 4) n--;
    return n;
}
