"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LONG_STAY = exports.DEFAULT_PRICE_CALENDAR = exports.ROOM_TEMPLATE_SEEDS = void 0;
exports.buildSeedTemplate = buildSeedTemplate;
exports.ROOM_TEMPLATE_SEEDS = [
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
exports.DEFAULT_PRICE_CALENDAR = [
    { type: 'weekday', rate: 1.0 },
    { type: 'weekend', rate: 1.2 },
    { type: 'holiday', rate: 1.8, dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'] },
];
exports.DEFAULT_LONG_STAY = [
    { minNights: 3, rate: 0.9 },
    { minNights: 5, rate: 0.8 },
];
/** 由种子 + base 生成完整模板输入（DOMAIN 即 RoomTemplate 字段）。 */
function buildSeedTemplate(seed) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
    const s = (_a = seed.override) !== null && _a !== void 0 ? _a : {};
    const specs = {
        bedType: (_c = (_b = s.specs) === null || _b === void 0 ? void 0 : _b.bedType) !== null && _c !== void 0 ? _c : 'king',
        bedDesc: (_e = (_d = s.specs) === null || _d === void 0 ? void 0 : _d.bedDesc) !== null && _e !== void 0 ? _e : '大床 1.8m',
        area: (_g = (_f = s.specs) === null || _f === void 0 ? void 0 : _f.area) !== null && _g !== void 0 ? _g : 40,
        capacity: (_j = (_h = s.specs) === null || _h === void 0 ? void 0 : _h.capacity) !== null && _j !== void 0 ? _j : 2,
        maxCapacity: (_l = (_k = s.specs) === null || _k === void 0 ? void 0 : _k.maxCapacity) !== null && _l !== void 0 ? _l : 2,
        addBed: (_o = (_m = s.specs) === null || _m === void 0 ? void 0 : _m.addBed) !== null && _o !== void 0 ? _o : false,
        smoke: (_q = (_p = s.specs) === null || _p === void 0 ? void 0 : _p.smoke) !== null && _q !== void 0 ? _q : 'forbidden',
        window: (_s = (_r = s.specs) === null || _r === void 0 ? void 0 : _r.window) !== null && _s !== void 0 ? _s : 'has',
        breakfast: (_u = (_t = s.specs) === null || _t === void 0 ? void 0 : _t.breakfast) !== null && _u !== void 0 ? _u : 'included',
        breakfastCount: (_w = (_v = s.specs) === null || _v === void 0 ? void 0 : _v.breakfastCount) !== null && _w !== void 0 ? _w : 2,
        amenities: (_y = (_x = s.specs) === null || _x === void 0 ? void 0 : _x.amenities) !== null && _y !== void 0 ? _y : ['空调', '液晶电视', '独立卫浴', '无线网络'],
        tags: (_0 = (_z = s.specs) === null || _z === void 0 ? void 0 : _z.tags) !== null && _0 !== void 0 ? _0 : [],
    };
    const view = (_2 = (_1 = s.roomsView) !== null && _1 !== void 0 ? _1 : specs.tags[0]) !== null && _2 !== void 0 ? _2 : '标准';
    const baseFloor = Math.max(6, Math.floor(((_3 = specs.area) !== null && _3 !== void 0 ? _3 : 40) / 10) + 5);
    return {
        code: seed.code,
        name: seed.name,
        enabled: true,
        sortOrder: seed.sortOrder,
        coverAssetId: null,
        specs,
        defaultRooms: Array.from({ length: 6 }, (_, i) => {
            const idx = i % 2;
            const floor = baseFloor + Math.floor(i / 2);
            return { no: `${floor}0${idx === 0 ? 1 : 2}`, floor, view };
        }),
        basePriceCent: (_4 = s.basePriceCent) !== null && _4 !== void 0 ? _4 : 28800,
        priceCalendar: (_5 = s.priceCalendar) !== null && _5 !== void 0 ? _5 : exports.DEFAULT_PRICE_CALENDAR.map((p) => (Object.assign(Object.assign({}, p), { dates: p.dates ? [...p.dates] : undefined }))),
        longStayDiscount: (_6 = s.longStayDiscount) !== null && _6 !== void 0 ? _6 : exports.DEFAULT_LONG_STAY.map((d) => (Object.assign({}, d))),
        minNights: (_7 = s.minNights) !== null && _7 !== void 0 ? _7 : 1,
        maxNights: (_8 = s.maxNights) !== null && _8 !== void 0 ? _8 : 30,
        advanceDays: (_9 = s.advanceDays) !== null && _9 !== void 0 ? _9 : 30,
        checkInTime: (_10 = s.checkInTime) !== null && _10 !== void 0 ? _10 : '14:00',
        checkOutTime: (_11 = s.checkOutTime) !== null && _11 !== void 0 ? _11 : '12:00',
        cancelPolicy: (_12 = s.cancelPolicy) !== null && _12 !== void 0 ? _12 : { type: 'freeUntil', freeUntilHours: 24 },
        depositType: (_13 = s.depositType) !== null && _13 !== void 0 ? _13 : 'payAtHotel',
    };
}
//# sourceMappingURL=room-template-seeds.js.map