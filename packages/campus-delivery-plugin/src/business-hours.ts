/**
 * 店铺营业时间解析（后端）：与 C 端 `utils/store-status.ts` 同口径，避免两侧判断不一致。
 * 支持全角冒号、多种连接符、逗号/顿号/分号分隔的多时段；跨零点（如 18:00-02:00）。
 * 生效时区固定校园 UTC+8（见 campus-time.ts），不随部署机器时区漂移。
 */
import { CAMPUS_TZ_OFFSET_MS } from './campus-time';

interface Range { start: number; end: number }

function toMinutes(hm: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 24 || mi > 59) return null;
    return h * 60 + mi;
}

export function parseBusinessHours(raw?: string | null): Range[] {
    const text = String(raw ?? '')
        .replace(/：/g, ':')
        .replace(/[–—~～至]/g, '-')
        .replace(/[，、;；/]/g, ',');
    const out: Range[] = [];
    for (const part of text.split(',')) {
        const m = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(part);
        if (!m) continue;
        const start = toMinutes(m[1]);
        let end = toMinutes(m[2]);
        if (start == null || end == null) continue;
        if (end <= start) end += 1440; // 跨零点
        out.push({ start, end });
    }
    return out.sort((a, b) => a.start - b.start);
}

/** 校园时区当前分钟数（0-1439） */
export function campusNowMinutes(now: number = Date.now()): number {
    const d = new Date(now + CAMPUS_TZ_OFFSET_MS);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** 是否在营业时段内：未配置营业时间视为营业（不误伤存量店铺） */
export function isWithinBusinessHours(raw: string | null | undefined, now: number = Date.now()): boolean {
    const ranges = parseBusinessHours(raw);
    if (!ranges.length) return true;
    const cur = campusNowMinutes(now);
    return ranges.some(r => cur >= r.start && cur < r.end)
        || ranges.some(r => cur + 1440 >= r.start && cur + 1440 < r.end);
}
