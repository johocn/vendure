"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBusinessHours = parseBusinessHours;
exports.campusNowMinutes = campusNowMinutes;
exports.isWithinBusinessHours = isWithinBusinessHours;
exports.nextBusinessTransition = nextBusinessTransition;
/**
 * 店铺营业时间解析（后端）：与 C 端 `utils/store-status.ts` 同口径，避免两侧判断不一致。
 * 支持全角冒号、多种连接符、逗号/顿号/分号分隔的多时段；跨零点（如 18:00-02:00）。
 * 生效时区固定校园 UTC+8（见 campus-time.ts），不随部署机器时区漂移。
 */
const campus_time_1 = require("./campus-time");
function toMinutes(hm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
    if (!m)
        return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 24 || mi > 59)
        return null;
    return h * 60 + mi;
}
function parseBusinessHours(raw) {
    const text = String(raw !== null && raw !== void 0 ? raw : '')
        .replace(/：/g, ':')
        .replace(/[–—~～至]/g, '-')
        .replace(/[，、;；/]/g, ',');
    const out = [];
    for (const part of text.split(',')) {
        const m = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(part);
        if (!m)
            continue;
        const start = toMinutes(m[1]);
        let end = toMinutes(m[2]);
        if (start == null || end == null)
            continue;
        if (end <= start)
            end += 1440; // 跨零点
        out.push({ start, end });
    }
    return out.sort((a, b) => a.start - b.start);
}
/** 校园时区当前分钟数（0-1439） */
function campusNowMinutes(now = Date.now()) {
    const d = new Date(now + campus_time_1.CAMPUS_TZ_OFFSET_MS);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}
/** 是否在营业时段内：未配置营业时间视为营业（不误伤存量店铺） */
function isWithinBusinessHours(raw, now = Date.now()) {
    const ranges = parseBusinessHours(raw);
    if (!ranges.length)
        return true;
    const cur = campusNowMinutes(now);
    return ranges.some(r => cur >= r.start && cur < r.end)
        || ranges.some(r => cur + 1440 >= r.start && cur + 1440 < r.end);
}
function toHM(min) {
    const m = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/**
 * 下一次切换点：取所有时段起点/终点中「严格晚于当前分钟」的最近一个。
 * 未配置营业时间 → null（全天营业，无自动切换）。
 */
function nextBusinessTransition(raw, now = Date.now()) {
    const ranges = parseBusinessHours(raw);
    if (!ranges.length)
        return null;
    const cur = campusNowMinutes(now);
    let best = null;
    for (const r of ranges) {
        // 跨零点时段：起点/终点在相邻两天都会出现，取 -1/0/+1 三天覆盖
        for (const k of [-1, 0, 1]) {
            for (const b of [
                { at: r.start + k * 1440, action: 'open' },
                { at: r.end + k * 1440, action: 'close' },
            ]) {
                if (b.at > cur && (!best || b.at < best.at))
                    best = b;
            }
        }
    }
    if (!best)
        return null;
    return {
        action: best.action,
        at: toHM(best.at),
        inMinutes: best.at - cur,
        today: best.at < 1440,
    };
}
//# sourceMappingURL=business-hours.js.map