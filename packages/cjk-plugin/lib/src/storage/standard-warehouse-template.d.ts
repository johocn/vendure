/** 中小型仓库标准库位模板：4 个库区共 18 个库位 */
export interface StandardZoneSpec {
    code: string;
    name: string;
    racks: number;
    levels: number;
}
export declare const STANDARD_WAREHOUSE_ZONES: StandardZoneSpec[];
/** 零填充到 2 位，保证编码长度一致 */
export declare function pad2(n: number): string;
/** 生成库位编码：A-01-03 */
export declare function binCode(zoneCode: string, rowNo: number, levelNo: number): string;
/** 展开某个库区规格为库位编码清单 */
export declare function expandZone(spec: StandardZoneSpec): Array<{
    code: string;
    rowNo: number;
    levelNo: number;
}>;
/** 模板总库位数，用于前端按钮文案与单测断言 */
export declare const STANDARD_BIN_COUNT: number;
