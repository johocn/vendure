/**
 * 加料/小料 + 套餐/组合商品（P1-2）：配置解析、选择校验与计价的纯函数。
 * C 端前端预估展示与后端结算落账必须共用同一口径（否则页面价格与实付不符）。
 *
 * 安全前提：C 端只上传「加料选择的引用」（组名 + 选项名），**不上传金额**；
 * 金额一律由服务端按商品自身配置解析，避免前端篡改价格。
 */
/** 结算 surcharge 的幂等标记：按 sku 精确识别本插件写入的加料费 */
export declare const ADDON_FEE_SKU = "campus-addon-fee";
/** 配置上限（后台保存与解析共用，防止脏数据撑爆列表/小票） */
export declare const ADDON_MAX_GROUPS = 5;
export declare const ADDON_MAX_OPTIONS_PER_GROUP = 12;
export declare const ADDON_MAX_PRICE_FEN = 100000;
export declare const COMBO_MAX_ITEMS = 20;
export declare const ADDON_TEXT_MAX = 20;
export interface AddonOptionConfig {
    name: string;
    /** 加价（分），0 = 免费加料 */
    price: number;
}
export interface AddonGroupConfig {
    name: string;
    /** 最少选几项（0/undefined = 不必选；≥1 = 必选） */
    min?: number | null;
    /** 最多选几项（0/null/undefined = 不限） */
    max?: number | null;
    options: AddonOptionConfig[];
}
export interface ComboItemConfig {
    name: string;
    qty: number;
    /** 单份参考价（分，可空）；用于 C 端计算「原价 / 立省」 */
    price?: number | null;
}
export interface ComboConfig {
    title?: string | null;
    items: ComboItemConfig[];
    note?: string | null;
}
/** 加料选择引用：仅组名 + 选项名，金额由服务端解析（写库前） */
export interface AddonSelection {
    g: string;
    n: string;
}
/** 加料快照（解析结果）：组名 + 选项名 + 单份加价（分） */
export interface AddonSnapshot {
    g: string;
    n: string;
    /** 单份加价（分） */
    p: number;
}
/**
 * 解析商品加料组配置。入参可为 JSON 字符串或已解析对象；任何非法结构都退回空数组，绝不抛错。
 * 解析阶段即完成清洗：去空名、限长、限数量、金额归一。
 */
export declare function parseAddonGroups(raw: unknown): AddonGroupConfig[];
/** 解析套餐配置；items 为空视为非套餐（返回 null） */
export declare function parseCombo(raw: unknown): ComboConfig | null;
/**
 * 解析订单行上的加料选择快照，并按商品当前配置做「白名单过滤」：
 * 配置里不存在的组/选项一律丢弃（商品改配置后下单的旧快照不会凭空产生费用）。
 */
export declare function resolveAddonSelection(raw: unknown, groups: AddonGroupConfig[]): AddonSelection[];
/**
 * 把「加料选择引用」按商品配置解析为带价快照。
 * 配置里不存在的组/选项一律丢弃（客户端传任意字符串也无法凭空产生费用）；
 * 逐组套用 max 上限；同一组内同名去重。
 */
export declare function buildAddonSnapshot(raw: unknown, groups: AddonGroupConfig[]): AddonSnapshot[];
/**
 * 单行加料费（分）= 服务端解析出的单份加价和 × 件数。
 * 金额始终由商品当前配置决定，OrderLine 上只存引用（不含价格），因此不存在改包篡改。
 */
export declare function quoteAddonFeePerLine(raw: unknown, groupsRaw: unknown, quantity: number): number;
/** 订单级加料费合计（分） */
export declare function quoteAddonFee(lines: Array<{
    addons: unknown;
    groups: unknown;
    quantity: number;
}>): number;
/** 加料展示文本（购物车/订单行/小票）：'加蛋 / 加辣' */
export declare function addonDisplayText(raw: unknown, separator?: string): string;
/** 套餐原价合计（分）：仅有价格的内含项参与；返回 null 表示无法计算 */
export declare function comboOriginalPrice(combo: ComboConfig | null | undefined): number | null;
/** 套餐内容展示文本：'宫保鸡丁×1 / 米饭×1' */
export declare function comboItemsText(combo: ComboConfig | null | undefined, separator?: string): string;
/** 序列化为 customFields 存储值（空结构写 null，便于「清除」语义） */
export declare function serializeAddonGroups(groups: AddonGroupConfig[]): string | null;
export declare function serializeCombo(combo: ComboConfig | null | undefined): string | null;
