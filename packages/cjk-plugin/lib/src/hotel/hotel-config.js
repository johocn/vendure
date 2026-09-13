"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayTypeFor = dayTypeFor;
exports.validateHotelConfig = validateHotelConfig;
// 逐日类型判定：custom > holiday > weekend（周五~周日）> weekday（周一~周四）
// 无 segments 时按星期判断；有 dates 的段优先于星期类
function dayTypeFor(dateStr, segments) {
    var _a;
    const d = new Date(dateStr + 'T00:00:00');
    if (Number.isNaN(d.getTime()))
        return 'weekday';
    for (const seg of segments) {
        if ((seg.type === 'holiday' || seg.type === 'custom') && ((_a = seg.dates) === null || _a === void 0 ? void 0 : _a.includes(dateStr))) {
            return seg.type;
        }
    }
    const dow = d.getDay(); // 0=周日
    return dow === 0 || dow === 5 || dow === 6 ? 'weekend' : 'weekday';
}
function validateHotelConfig(cfg) {
    var _a;
    const errors = [];
    if (typeof cfg.basePriceCent !== 'number' || cfg.basePriceCent < 0) {
        errors.push('basePriceCent 必须为非负数字');
    }
    for (const seg of (_a = cfg.priceCalendar) !== null && _a !== void 0 ? _a : []) {
        if (seg.type !== 'weekday' && seg.type !== 'weekend' && seg.type !== 'holiday' && seg.type !== 'custom') {
            errors.push(`未知价格段类型: ${seg.type}`);
        }
        if ((seg.type === 'holiday' || seg.type === 'custom') && (!seg.dates || seg.dates.length === 0)) {
            errors.push(`${seg.type} 段必须提供 dates`);
        }
        if (seg.rate != null && seg.priceCent != null) {
            errors.push(`${seg.type} 段 rate 与 priceCent 只能二选一`);
        }
    }
    const specs = cfg.specs;
    if (specs && (specs.capacity < 1 || specs.maxCapacity < specs.capacity)) {
        errors.push('capacity 必须 ≥1 且 maxCapacity ≥ capacity');
    }
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=hotel-config.js.map