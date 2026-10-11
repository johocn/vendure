/** LocalizedText：jsonb 存储形态；键 zh-CN / en-US */
export type LocalizedText = string | Record<string, string>;

export interface DiyPluginOptions {
    /** 本实例租户端；缺省按环境变量 APP 推断，再缺省 nshop */
    app?: 'nshop' | 'vshop';
}

/* ------------------------- 模板 config（规格 §5.2，约定即接口） ------------------------- */

export interface SlotFilter {
    categoryCodes?: string[];
    shapes?: string[];
    diameterRange?: [number, number];
}

export interface TemplateSlot {
    key: string;
    name: LocalizedText;
    role: 'main' | 'secondary' | 'spacer' | 'focal' | 'decor';
    required: boolean;
    /** calculated=计算器算 | fixed | user */
    quantityMode: 'calculated' | 'fixed' | 'user';
    /** fixed 时的数量 */
    quantity?: number;
    /** user 时的 [min, max] */
    quantityRange?: [number, number];
    filter?: SlotFilter;
    defaultMaterialId?: string;
    /** 隔片：每隔几颗插一片 */
    defaultEvery?: number;
}

export interface TemplateParam {
    key: string;
    type: 'number' | 'enum' | 'boolean';
    unit?: string;
    min?: number;
    max?: number;
    default?: number | string | boolean;
    options?: string[];
    ui?: string;
    advanced?: boolean;
}

export type TemplateConstraint =
    | { type: 'mutuallyExclusive'; slots: string[] }
    | { type: 'dependency'; slot: string; requires: string }
    | { type: 'requiredWith'; slots: string[] }
    | { type: 'quantityLink'; a: string; b: string; ratio: number };

export interface TemplatePresentation {
    /** C 端渲染器组件 key */
    renderer: string;
    /** C 端设计器积木块 key 列表 */
    blocks: string[];
}

export interface DiyTemplateConfig {
    slots: TemplateSlot[];
    params: TemplateParam[];
    constraints: TemplateConstraint[];
    presentation: TemplatePresentation;
}

/* ------------------------- DiyPlan.spec（搭配参数快照，规格 §6.1） ------------------------- */

export interface DiyPlanSlotSelection {
    materialId: string;
    /** user 数量槽位覆盖 */
    qtyOverride?: number;
    /** 隔片：每隔几颗插一片 */
    every?: number;
}

export interface DiyPlanSpec {
    /** slotKey → 选择 */
    slots: Record<string, DiyPlanSlotSelection>;
    /** 模板 params 键值对（wristSize/fit/gap…） */
    params: Record<string, number | string>;
    /** 随机混色种子 */
    seed?: number;
}

/* ------------------------- DiyPlan.bom（BOM 快照，规格 §6.1） ------------------------- */

export interface DiyPlanBomItem {
    materialId: string;
    code: string;
    name: string;
    spec: string;
    /** 分 */
    unitPrice: number;
    qty: number;
    /** 分 */
    subtotal: number;
}

export interface DiyPlanBom {
    items: DiyPlanBomItem[];
    totalCount: number;
    /** 分 */
    totalAmount: number;
    cord?: { length: number; diameter: number; note?: string };
    geometry?: { innerCircumference?: number; feedback?: string; clearance?: number };
    /** 下单复算价 ≠ 报价价时，订单行同时记录报价参考价（规格 §6.3） */
    quoteRefAmount?: number;
}

/* ------------------------- 输入/过滤 ------------------------- */

export interface DiyCategoryInput {
    id?: string;
    app?: string;
    code?: string;
    parentId?: number | null;
    name?: LocalizedText;
    image?: string | null;
    sortOrder?: number;
    enabled?: boolean;
}

export interface DiyMaterialInput {
    id?: string;
    app?: string;
    code?: string;
    name?: LocalizedText;
    categoryId?: number;
    shape?: string;
    diameter?: number | null;
    axialLength?: number | null;
    holeSize?: number | null;
    attrs?: Record<string, any> | null;
    render?: Record<string, any> | null;
    price?: number;
    priceUnit?: string;
    currency?: string;
    stock?: number;
    images?: string[] | null;
    enabled?: boolean;
    sortOrder?: number;
}

export interface DiyTemplateInput {
    id?: string;
    app?: string;
    code?: string;
    name?: LocalizedText;
    description?: LocalizedText | null;
    thumb?: string | null;
    images?: string[] | null;
    config?: DiyTemplateConfig | null;
    calculatorKey?: string | null;
    status?: 'draft' | 'enabled' | 'disabled';
    sortOrder?: number;
}

export interface DiyMaterialFilter {
    categoryId?: number;
    categoryCode?: string;
    shapes?: string[];
    diameterMin?: number;
    diameterMax?: number;
    keyword?: string;
    onlyEnabled?: boolean;
    skip?: number;
    take?: number;
}

export interface DiyPlanListOptions {
    app?: string;
    status?: 'draft' | 'quoted' | 'ordered';
    userId?: number;
    skip?: number;
    take?: number;
}
