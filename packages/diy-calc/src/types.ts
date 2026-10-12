/** 适配反馈：偏紧/贴合/合适/宽松/过松（阈值见 bracelet.feedbackOf） */
export type FitFeedback = 'too-tight' | 'snug' | 'ok' | 'loose' | 'too-loose';

/**
 * 计算器消费的素材最小视图（对齐 DiyMaterial 列字段）。
 * 金额单位「分」，长度单位「mm」。
 */
export interface CalcMaterial {
  id: string;
  code: string;
  name: string;
  /** round / barrel / drum / faceted / spacer / cube / custom */
  shape: string;
  /** 径向直径 mm——渲染与筛选用 */
  diameter: number | null;
  /** 轴向长度 mm——算量用它（隔片/桶珠远小于直径） */
  axialLength: number | null;
  /** 孔径 mm——配线校验用 */
  holeSize: number | null;
  /** 单价（分） */
  price: number;
}

/** 槽位角色：decor 装饰只计价不进几何环 */
export type SlotRole = 'main' | 'secondary' | 'spacer' | 'focal' | 'decor';

/** 槽位选择（来自 DiyPlan.spec.slots） */
export interface SlotSelection {
  key: string;
  role: SlotRole;
  materialId?: string;
  /** user 数量槽位的覆盖值 */
  qtyOverride?: number;
  /** 隔片：每隔几颗插一片 */
  every?: number;
  /** 序列排布模式：alternate 交替 / random 随机 / zoned 分区 */
  arrange?: 'alternate' | 'random' | 'zoned';
}

/** 计算器统一输入 */
export interface CalculatorInput {
  /** 模板 params 声明的键值对（wristSize/fit/gap…），调用方已完成钳制 */
  params: Record<string, number | string>;
  slots: SlotSelection[];
  /** 参与素材（按 spec.slots 引用的 materialId 解析后的完整行） */
  materials: CalcMaterial[];
}

/** 算量几何结论（bead-diy CalcResult 同构） */
export interface CalcResult {
  /** 需求颗数（收敛后） */
  count: number;
  /** 公式直出颗数（收敛前，便于测试分别验证公式与收敛） */
  countInitial: number;
  /** 珠子中心线周长（mm） */
  centerCircumference: number;
  /** 成品内孔实际周长（mm）——用户手腕要穿过的那个洞 */
  innerCircumference: number;
  feedback: FitFeedback;
  /** 相对手围余量（mm），正 = 有余量 */
  clearance: number;
  /** ±1 颗的反馈建议 */
  adjustHint: { delta: number; feedback: FitFeedback }[];
  /** 建议配线长度（mm）= 中心线周长 + 弹力线打结留量 */
  cordLength: number;
  /** 建议配线线径（mm），calculator 依据最小孔径细化 */
  cordDiameter: number;
}

/** BOM 行（按素材聚合；金额分） */
export interface CalcBomItem {
  materialId: string;
  code: string;
  name: string;
  /** 规格串，如 "8mm 主珠" */
  spec: string;
  unitPrice: number;
  qty: number;
  subtotal: number;
}

export interface CalcBom {
  items: CalcBomItem[];
  totalCount: number;
  /** 分 */
  totalAmount: number;
  cord: { length: number; diameter: number; note: string } | null;
  geometry: Pick<CalcResult, 'innerCircumference' | 'feedback' | 'clearance'> | null;
}

/** 计算器统一输出 */
export interface CalculatorOutput {
  /** 几何/算量结论（sum 这类选择型计算器为 null） */
  calc: CalcResult | null;
  bom: CalcBom;
}

export type Calculator = (input: CalculatorInput) => CalculatorOutput;
