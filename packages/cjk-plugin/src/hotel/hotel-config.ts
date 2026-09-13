// 酒店房型配置：类型 + 校验纯函数（SSR/服务端两用，坏数据返回错误清单，不抛异常）
export type PriceSegmentType = 'weekday' | 'weekend' | 'holiday' | 'custom';

export interface PriceSegment {
  type: PriceSegmentType;
  rate?: number;        // 系数（相对 basePriceCent）
  priceCent?: number;   // 固定价（与 rate 二选一）
  dates?: string[];     // holiday/custom 必填（YYYY-MM-DD）
}

export interface LongStayDiscount {
  minNights: number;
  rate: number;
}

export interface CancelPolicy {
  type: 'freeUntil' | 'nonRefundable';
  freeUntilHours?: number;
}

export interface RoomDetail {
  no: string;
  floor: number;
  view?: string;
}

export interface HotelConfig {
  templateCode?: string;
  specs?: {
    bedType: string;
    bedDesc?: string;
    area: number;
    capacity: number;
    maxCapacity: number;
    addBed?: boolean;
    addBedFeeCent?: number;
    smoke?: string;
    window?: string;
    breakfast?: string;
    breakfastCount?: number;
    amenities?: Array<string | Record<string, string>>;
    tags?: Array<string | Record<string, string>>;
  };
  rooms?: RoomDetail[];
  basePriceCent: number;
  priceCalendar?: PriceSegment[];
  longStayDiscount?: LongStayDiscount[];
  minNights?: number;
  maxNights?: number;
  advanceDays?: number;
  checkInTime?: string;
  checkOutTime?: string;
  cancelPolicy?: CancelPolicy;
  depositType?: string;
}

// 逐日类型判定：custom > holiday > weekend（周五~周日）> weekday（周一~周四）
// 无 segments 时按星期判断；有 dates 的段优先于星期类
export function dayTypeFor(dateStr: string, segments: PriceSegment[]): PriceSegmentType {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 'weekday';
  for (const seg of segments) {
    if ((seg.type === 'holiday' || seg.type === 'custom') && seg.dates?.includes(dateStr)) {
      return seg.type;
    }
  }
  const dow = d.getDay(); // 0=周日
  return dow === 0 || dow === 5 || dow === 6 ? 'weekend' : 'weekday';
}

export function validateHotelConfig(cfg: Partial<HotelConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof cfg.basePriceCent !== 'number' || cfg.basePriceCent < 0) {
    errors.push('basePriceCent 必须为非负数字');
  }
  for (const seg of cfg.priceCalendar ?? []) {
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
