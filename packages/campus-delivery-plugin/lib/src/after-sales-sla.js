"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessDeadline = businessDeadline;
/**
 * 售后 SLA 营业时段感知（§99）：超时/临期只统计门店营业时段，非营业时间不计入处理时长。
 * 与 business-hours.ts 同口径（校园 UTC+8），未配置营业时间视为全天营业，退回「申请时间 + 时限」。
 */
const business_hours_1 = require("./business-hours");
const campus_time_1 = require("./campus-time");
const DAY_MINUTES = 1440;
const MINUTE_MS = 60000;
const MAX_DAYS = 731;
/**
 * 计算售后截止时间。
 * @param createdAt 售后申请时间
 * @param timeoutHours 处理时限（营业小时数）
 * @param businessHours 门店营业时间文案（如 10:00-22:00）；空=全天营业
 * @param pausedMs SLA 暂停累计时长（§95），按线性顺延
 * @returns 截止时间（毫秒时间戳）
 */
function businessDeadline(createdAt, timeoutHours, businessHours, pausedMs = 0) {
    const startMs = typeof createdAt === 'number' ? createdAt : createdAt.getTime();
    const pause = Math.max(0, Math.round(Number(pausedMs) || 0));
    const plainMs = Math.max(0, Math.round((Number(timeoutHours) || 0) * 3600000)) + pause;
    const ranges = (0, business_hours_1.parseBusinessHours)(businessHours);
    if (!ranges.length)
        return startMs + plainMs;
    const durationMin = Math.max(0, Math.round((Number(timeoutHours) || 0) * 60));
    // 绝对「校园分钟」索引：校园时间（UTC+8）+ 毫秒向上取整，避免起点落在分钟中间
    let cursor = Math.ceil((startMs + campus_time_1.CAMPUS_TZ_OFFSET_MS) / MINUTE_MS);
    let remaining = durationMin;
    for (let guard = 0; guard < MAX_DAYS && remaining > 0; guard++) {
        const dayIdx = Math.floor(cursor / DAY_MINUTES);
        // 跨零点时段需要取前一天/后一天展开，覆盖凌晨与深夜
        const segments = ranges
            .flatMap(r => [-1, 0, 1].map(k => ({
            start: (dayIdx + k) * DAY_MINUTES + r.start,
            end: (dayIdx + k) * DAY_MINUTES + r.end,
        })))
            .filter(seg => seg.end > cursor)
            .sort((a, b) => a.start - b.start);
        if (!segments.length) {
            cursor = (dayIdx + 1) * DAY_MINUTES;
            continue;
        }
        let advanced = false;
        for (const seg of segments) {
            if (seg.end <= cursor)
                continue;
            const from = Math.max(seg.start, cursor);
            const take = seg.end - from;
            if (remaining <= take) {
                const endMin = from + remaining;
                return endMin * MINUTE_MS - campus_time_1.CAMPUS_TZ_OFFSET_MS + pause;
            }
            remaining -= take;
            cursor = seg.end;
            advanced = true;
        }
        if (!advanced)
            cursor = (dayIdx + 1) * DAY_MINUTES;
    }
    // 兜底（正常不会走到）：按最后游标顺延
    return cursor * MINUTE_MS - campus_time_1.CAMPUS_TZ_OFFSET_MS + pause;
}
//# sourceMappingURL=after-sales-sla.js.map