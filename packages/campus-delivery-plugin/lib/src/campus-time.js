"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPUS_TZ_OFFSET_MS = void 0;
exports.startOfCampusDay = startOfCampusDay;
exports.campusHour = campusHour;
exports.campusDayKey = campusDayKey;
/**
 * 校园业务时区固定 UTC+8（无夏令时）。
 * 统计日界/小时桶不随部署机器时区漂移（服务器切 UTC 后「今日」不再偏移 8 小时）。
 */
exports.CAMPUS_TZ_OFFSET_MS = 8 * 3600000;
const DAY_MS = 24 * 3600000;
const pad2 = (n) => String(n).padStart(2, '0');
/** 时间戳所在「校园自然日」的 0 点（返回 epoch ms） */
function startOfCampusDay(t) {
    const shifted = t + exports.CAMPUS_TZ_OFFSET_MS;
    return shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS) - exports.CAMPUS_TZ_OFFSET_MS;
}
/** 时间戳所在校园小时（0-23） */
function campusHour(t) {
    return new Date(t + exports.CAMPUS_TZ_OFFSET_MS).getUTCHours();
}
/** 时间戳所在校园自然日 key：YYYY-MM-DD */
function campusDayKey(t) {
    const d = new Date(t + exports.CAMPUS_TZ_OFFSET_MS);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
//# sourceMappingURL=campus-time.js.map