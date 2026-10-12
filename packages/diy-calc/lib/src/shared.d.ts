import { CalcBomItem, CalcMaterial } from './types';
/** 弹力线打结收尾留量（§7.6） */
export declare const CORD_TAIL = 160;
/** 线径可选档（mm），按最小孔径从大到小取 */
export declare const CORD_DIAMETERS: number[];
export declare function specOf(m: CalcMaterial): string;
export declare function bomItem(m: CalcMaterial, qty: number): CalcBomItem;
export declare function aggregate(items: CalcBomItem[]): CalcBomItem[];
export declare function pickCordDiameter(holeMin: number | null): number;
