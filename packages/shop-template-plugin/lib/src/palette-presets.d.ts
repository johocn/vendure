/**
 * 配色预设权威副本（后端）。
 *
 * ⚠️ 三处同步：本文件为权威副本；C 端保留 SSR 运行时副本
 *   - nshop: layers/base/app/utils/palette-presets.ts
 *   - vshop: src/utils/palette-presets.ts
 * 任何新增/改色必须三处同改，否则后台预览与 C 端渲染会漂移。
 */
export interface PaletteToken {
    primaryColor?: string;
    accentColor?: string;
    radius?: number | string;
    [key: string]: unknown;
}
export interface ThemePaletteDef {
    scheme: string;
    name: string;
    tokens: PaletteToken;
}
/** 8 套预设（平台对标风 4 + 气质品牌风 4），默认 dawn-gold */
export declare const PALETTE_PRESETS: Record<string, ThemePaletteDef>;
