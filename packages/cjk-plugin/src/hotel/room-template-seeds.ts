import { RoomTemplate } from './room-template.entity';
import { CancelPolicy, LongStayDiscount, PriceSegment } from './hotel-config';

export type BedType = 'king' | 'twin' | 'single' | 'triple' | 'family' | 'suite';

export interface RoomTemplateSeed {
    code: string;
    name: string;
    sortOrder: number;
    override?: {
        specs?: {
            bedType?: BedType; bedDesc?: string; area?: number; capacity?: number; maxCapacity?: number;
            addBed?: boolean; addBedFeeCent?: number; smoke?: 'allowed' | 'forbidden'; window?: 'has' | 'none';
            breakfast?: 'included' | 'notIncluded'; breakfastCount?: number;
            amenities?: string[]; tags?: string[];
        };
        roomsView?: string;        // 房间特色景观（默认取 tags 首项）
        basePriceCent?: number;
        priceCalendar?: PriceSegment[];
        longStayDiscount?: LongStayDiscount[];
        minNights?: number; maxNights?: number; advanceDays?: number;
        checkInTime?: string; checkOutTime?: string;
        cancelPolicy?: CancelPolicy; depositType?: string;
    };
}

export const ROOM_TEMPLATE_SEEDS: RoomTemplateSeed[] = [
    { code: 'standard-twin', name: '标准双床房', sortOrder: 10, override: { basePriceCent: 28800, specs: { bedType: 'twin', bedDesc: '双床 1.2m×2', area: 28, tags: ['安静', '禁烟'] } } },
    { code: 'standard-king', name: '标准大床房', sortOrder: 20, override: { basePriceCent: 28800, specs: { area: 28, tags: ['安静', '禁烟'] } } },
    { code: 'superior-king', name: '高级大床房', sortOrder: 30, override: { basePriceCent: 35800, specs: { area: 35, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '房内躺椅'], tags: ['城景'] } } },
    { code: 'superior-twin', name: '高级双床房', sortOrder: 40, override: { basePriceCent: 35800, specs: { bedType: 'twin', bedDesc: '双床 1.35m×2', area: 35, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '房内躺椅'], tags: ['城景'] } } },
    { code: 'deluxe-king', name: '豪华大床房', sortOrder: 50, override: { basePriceCent: 45800, specs: { bedDesc: '大床 2.0m', area: 42, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '浴缸', '小吧台'], tags: ['湖景', '高层'] } } },
    { code: 'deluxe-twin', name: '豪华双床房', sortOrder: 60, override: { basePriceCent: 45800, specs: { bedType: 'twin', bedDesc: '双床 1.5m×2', area: 42, capacity: 3, maxCapacity: 3, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '浴缸', '小吧台'], tags: ['湖景'] } } },
    { code: 'business-king', name: '商务大床房', sortOrder: 70, override: { basePriceCent: 42800, specs: { area: 38, breakfastCount: 1, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '办公桌', '人体工学椅'], tags: ['商务', '静音'] } } },
    { code: 'business-twin', name: '商务双床房', sortOrder: 80, override: { basePriceCent: 42800, specs: { bedType: 'twin', bedDesc: '双床 1.35m×2', area: 38, breakfastCount: 1, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '办公桌', '人体工学椅'], tags: ['商务', '静音'] } } },
    { code: 'triple', name: '三人间', sortOrder: 90, override: { basePriceCent: 39800, specs: { bedType: 'triple', bedDesc: '单人床 1.2m×3', area: 45, capacity: 3, maxCapacity: 3, breakfastCount: 3, tags: ['宽敞', '家庭'] } } },
    { code: 'family-child', name: '家庭亲子房', sortOrder: 100, override: { basePriceCent: 51800, specs: { bedType: 'family', bedDesc: '大床 1.8m + 1.2m小床', area: 50, capacity: 3, maxCapacity: 4, breakfastCount: 3, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '儿童洗漱用品', '城堡小帐篷'], tags: ['亲子', '卡通'] } } },
    { code: 'executive-king', name: '行政大床房', sortOrder: 110, override: { basePriceCent: 68800, specs: { bedDesc: '大床 2.0m', area: 46, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '行政酒廊', '胶囊咖啡机'], tags: ['行政酒廊', '高层'] } } },
    { code: 'executive-suite', name: '行政套房', sortOrder: 120, override: { basePriceCent: 88800, specs: { bedDesc: '大床 2.0m', area: 65, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '行政酒廊', '独立会客区'], tags: ['行政酒廊', '会客'] } } },
    { code: 'deluxe-suite', name: '豪华套房', sortOrder: 130, override: { basePriceCent: 118800, specs: { bedDesc: '大床 2.0m', area: 75, capacity: 3, maxCapacity: 3, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '客厅', '按摩浴缸'], tags: ['客厅', '泡浴'] }, cancelPolicy: { type: 'freeUntil', freeUntilHours: 48 }, depositType: 'prepay' } },
    { code: 'presidential-suite', name: '总统套房', sortOrder: 140, override: { basePriceCent: 388800, specs: { bedType: 'suite', bedDesc: '大床 2.0m', area: 130, capacity: 4, maxCapacity: 4, breakfastCount: 4, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '独立客厅', '管家服务', '按摩浴缸'], tags: ['顶层', '管家服务'] }, roomsView: '城景', priceCalendar: [{ type: 'weekday', rate: 1.0 }, { type: 'weekend', rate: 1.3 }, { type: 'holiday', rate: 2.0, dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'] }], cancelPolicy: { type: 'freeUntil', freeUntilHours: 48 }, depositType: 'prepay' } },
    { code: 'theme-game', name: '电竞主题房', sortOrder: 150, override: { basePriceCent: 49800, specs: { bedType: 'twin', bedDesc: '电竞双床 1.2m×2', area: 40, breakfast: 'notIncluded', breakfastCount: 0, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '电竞椅', '电竞主机', '降噪耳机'], tags: ['电竞', '高配'] }, roomsView: '园景', priceCalendar: [{ type: 'weekday', rate: 1.0 }, { type: 'weekend', rate: 1.2 }, { type: 'holiday', rate: 1.8, dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'] }, { type: 'custom', rate: 1.5, dates: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31'] }], cancelPolicy: { type: 'nonRefundable' }, depositType: 'prepay' } },
    { code: 'theme-movie', name: '影音主题房', sortOrder: 160, override: { basePriceCent: 46800, specs: { area: 40, breakfast: 'notIncluded', breakfastCount: 0, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '投影', '环绕音响', '氛围灯'], tags: ['影音', '影院'] }, roomsView: '园景', priceCalendar: [{ type: 'weekday', rate: 1.0 }, { type: 'weekend', rate: 1.2 }, { type: 'holiday', rate: 1.8, dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'] }, { type: 'custom', rate: 1.5, dates: ['2026-07-01', '2026-08-31'] }], cancelPolicy: { type: 'nonRefundable' }, depositType: 'prepay' } },
    { code: 'theme-romantic', name: '情侣蜜月房', sortOrder: 170, override: { basePriceCent: 58800, specs: { bedDesc: '大床 2.0m', area: 45, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '浴缸', '香薰', '玫瑰布置'], tags: ['蜜月', '浪漫'] }, depositType: 'prepay' } },
    { code: 'apartment-family', name: '公寓家庭套房', sortOrder: 180, override: { basePriceCent: 72800, specs: { bedType: 'family', bedDesc: '大床 1.8m + 1.5m', area: 80, capacity: 4, maxCapacity: 5, breakfastCount: 4, amenities: ['空调', '液晶电视', '独立卫浴', '无线网络', '厨房', '洗衣机', '冰箱'], tags: ['家庭', '长住'] }, roomsView: '园景', minNights: 2, depositType: 'prepay' } },
];

/** 默认价格段（16 项中 theme-game 手写扩展；theme-movie/psych 用默认） */
export const DEFAULT_PRICE_CALENDAR: PriceSegment[] = [
    { type: 'weekday', rate: 1.0 },
    { type: 'weekend', rate: 1.2 },
    { type: 'holiday', rate: 1.8, dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'] },
];

export const DEFAULT_LONG_STAY: LongStayDiscount[] = [
    { minNights: 3, rate: 0.9 },
    { minNights: 5, rate: 0.8 },
];

/** 由种子 + base 生成完整模板输入（DOMAIN 即 RoomTemplate 字段）。 */
export function buildSeedTemplate(seed: RoomTemplateSeed): Omit<RoomTemplate, 'id' | 'createdAt' | 'updatedAt'> {
    const s = seed.override ?? {};
    const specs = {
        bedType: s.specs?.bedType ?? 'king',
        bedDesc: s.specs?.bedDesc ?? '大床 1.8m',
        area: s.specs?.area ?? 40,
        capacity: s.specs?.capacity ?? 2,
        maxCapacity: s.specs?.maxCapacity ?? 2,
        addBed: s.specs?.addBed ?? false,
        smoke: s.specs?.smoke ?? 'forbidden',
        window: s.specs?.window ?? 'has',
        breakfast: s.specs?.breakfast ?? 'included',
        breakfastCount: s.specs?.breakfastCount ?? 2,
        amenities: s.specs?.amenities ?? ['空调', '液晶电视', '独立卫浴', '无线网络'],
        tags: s.specs?.tags ?? [],
    };
    const view = s.roomsView ?? specs.tags[0] ?? '标准';
    const baseFloor = Math.max(6, Math.floor((specs.area ?? 40) / 10) + 5);
    return {
        code: seed.code,
        name: seed.name,
        enabled: true,
        sortOrder: seed.sortOrder,
        coverAssetId: null,
        specs,
        defaultRooms: Array.from({ length: 6 }, (_, i) => {
            const idx = i % 2; const floor = baseFloor + Math.floor(i / 2);
            return { no: `${floor}0${idx === 0 ? 1 : 2}`, floor, view };
        }),
        basePriceCent: s.basePriceCent ?? 28800,
        priceCalendar: s.priceCalendar ?? DEFAULT_PRICE_CALENDAR.map((p) => ({ ...p, dates: p.dates ? [...p.dates] : undefined })),
        longStayDiscount: s.longStayDiscount ?? DEFAULT_LONG_STAY.map((d) => ({ ...d })),
        minNights: s.minNights ?? 1,
        maxNights: s.maxNights ?? 30,
        advanceDays: s.advanceDays ?? 30,
        checkInTime: s.checkInTime ?? '14:00',
        checkOutTime: s.checkOutTime ?? '12:00',
        cancelPolicy: s.cancelPolicy ?? { type: 'freeUntil', freeUntilHours: 24 },
        depositType: s.depositType ?? 'payAtHotel',
    };
}
