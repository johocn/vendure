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
export const PALETTE_PRESETS: Record<string, ThemePaletteDef> = {
    'dawn-gold': { scheme: 'dawn-gold', name: '晨曦金', tokens: { primaryColor: '#d4a574', accentColor: '#fdf6ee', radius: 8 } },
    'jd-red': { scheme: 'jd-red', name: '京东红', tokens: { primaryColor: '#e1251b', accentColor: '#ffeceb', radius: 8 } },
    'taobao-orange': { scheme: 'taobao-orange', name: '淘宝橙', tokens: { primaryColor: '#ff5000', accentColor: '#fff0e6', radius: 8 } },
    'pdd-red': { scheme: 'pdd-red', name: '拼多多红', tokens: { primaryColor: '#e02e24', accentColor: '#ffe9e7', radius: 8 } },
    'vip-blue': { scheme: 'vip-blue', name: '唯品会蓝紫', tokens: { primaryColor: '#4a5cff', accentColor: '#edefff', radius: 8 } },
    'tech-blue': { scheme: 'tech-blue', name: '科技蓝', tokens: { primaryColor: '#0066ff', accentColor: '#e6f0ff', radius: 10 } },
    'fresh-green': { scheme: 'fresh-green', name: '清雅绿', tokens: { primaryColor: '#07b873', accentColor: '#e6f9f0', radius: 10 } },
    'midnight': { scheme: 'midnight', name: '极夜黑', tokens: { primaryColor: '#1c1c1e', accentColor: '#333333', radius: 8 } },
    'usemall-coral': { scheme: 'usemall-coral', name: '珊瑚粉点缀', tokens: { primaryColor: '#e0433f', accentColor: '#ff6a6c', radius: 8 } },
};