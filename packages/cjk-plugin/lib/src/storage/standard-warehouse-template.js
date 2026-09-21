"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_BIN_COUNT = exports.STANDARD_WAREHOUSE_ZONES = void 0;
exports.pad2 = pad2;
exports.binCode = binCode;
exports.expandZone = expandZone;
exports.STANDARD_WAREHOUSE_ZONES = [
    { code: 'A', name: '常温存储区', racks: 2, levels: 5 },
    { code: 'B', name: '冷藏区', racks: 1, levels: 3 },
    { code: 'C', name: '大件区', racks: 1, levels: 3 },
    { code: 'D', name: '收货暂存区', racks: 1, levels: 2 },
];
/** 零填充到 2 位，保证编码长度一致 */
function pad2(n) {
    return String(n).padStart(2, '0');
}
/** 生成库位编码：A-01-03 */
function binCode(zoneCode, rowNo, levelNo) {
    return `${zoneCode}-${pad2(rowNo)}-${pad2(levelNo)}`;
}
/** 展开某个库区规格为库位编码清单 */
function expandZone(spec) {
    const out = [];
    for (let r = 1; r <= spec.racks; r++) {
        for (let l = 1; l <= spec.levels; l++) {
            out.push({ code: binCode(spec.code, r, l), rowNo: r, levelNo: l });
        }
    }
    return out;
}
/** 模板总库位数，用于前端按钮文案与单测断言 */
exports.STANDARD_BIN_COUNT = exports.STANDARD_WAREHOUSE_ZONES.reduce((sum, z) => sum + z.racks * z.levels, 0); // = 18
//# sourceMappingURL=standard-warehouse-template.js.map