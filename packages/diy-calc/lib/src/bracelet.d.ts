import { FitFeedback } from './types';
/** 颗数上下限（§7.2）：超出说明参数组合不合理 */
export declare const MIN_COUNT = 8;
export declare const MAX_COUNT = 120;
/** fit → 体感松量 ease（mm）：贴手 4 / 舒适 10 / 宽松 20（§7.1） */
export declare function easeOf(fit: string): number;
/** 单颗节距对应中心角（弦长近似，rad）：θ = 2·asin(pitch / (2R)) */
export declare function angleOf(pitch: number, R: number): number;
/** N 颗节距 pitch 的珠连成正 N 边形后的内孔周长（mm）：π·pitch/sin(π/N) − π·d */
export declare function innerCircOf(n: number, pitch: number, d: number): number;
/** 相对手围余量的反馈分级（§7.1 ⑦） */
export declare function feedbackOf(clearance: number): FitFeedback;
export interface BraceletGeometry {
    count: number;
    countInitial: number;
    centerCircumference: number;
    innerCircumference: number;
    feedback: FitFeedback;
    clearance: number;
    adjustHint: {
        delta: number;
        feedback: FitFeedback;
    }[];
}
/**
 * 手串几何主算（§7.1 + §7.2）：
 * - pitch = 轴长 + gap（算量用轴向长度，不是直径）
 * - L_center = W + ease + π·d（内径修正项——漏掉它珠子会全部偏少，手串戴不上）
 * - countInitial = floor(2π/θ)；count = pickBestCount 收敛值
 * - centerCircumference = 收敛后实际中心线周长 π·pitch/sin(π/count)
 */
export declare function computeBraceletGeometry(input: {
    wristSize: number;
    diameter: number;
    axialLength: number;
    gap: number;
    ease: number;
}): BraceletGeometry;
/** §7.2 收敛：innerCirc(n) − W 落入 [4, 25)；兜不住手腕先加、过松则减 */
export declare function pickBestCount(W: number, d: number, pitch: number, n0: number): number;
