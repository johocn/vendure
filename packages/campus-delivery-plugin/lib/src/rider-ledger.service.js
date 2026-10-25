"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderLedgerService = void 0;
// P8-4 后台补齐（2026-10-25）：
// ① 骑手分成台账：rider_earning 原先只有写入与骑手端自查，运营无台账可对账；
// ② 骑手轨迹：实时位置仅写订单 customFields，送达即清空，事后无法追溯配送路线。
// 本服务提供两者只读查询（渠道隔离 + 分页/合计 + 轨迹距离估算），写入口仍在 RiderTaskService。
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const DAY_MS = 86400000;
/** 单次轨迹最多返回点数：前端折线按比例抽稀，避免一次回传几十万点 */
const MAX_TRACK_POINTS = 5000;
/** PG 原生查询在不同驱动形态下可能返回 [rows, affected]：统一取行数组 */
function rowsOf(res) {
    const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
    return Array.isArray(rows) ? rows : [];
}
/** YYYY-MM-DD（东八区自然日）→ 当日 00:00 时间戳 */
function campusDayStart(date, field) {
    const text = String(date !== null && date !== void 0 ? date : '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
        throw new core_1.UserInputError(`${field}格式应为 YYYY-MM-DD`);
    const ts = new Date(`${text}T00:00:00+08:00`).getTime();
    if (!Number.isFinite(ts))
        throw new core_1.UserInputError(`${field}不是有效日期`);
    return ts;
}
/** 球面直线距离（米），与 RiderTaskService 的 ETA 估算保持一致 */
function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}
let RiderLedgerService = class RiderLedgerService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 分成台账：按渠道 + 日期/骑手/状态/订单号筛选，返回当前页与全量合计（金额单位分） */
    async earningsLedger(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const where = ['e."channelId" = $1'];
        const params = [ctx.channelId];
        const add = (value) => {
            params.push(value);
            return `$${params.length}`;
        };
        if (input.from) {
            where.push(`e."createdAt" >= ${add(new Date(campusDayStart(input.from, '开始日期')))}`);
        }
        if (input.to) {
            where.push(`e."createdAt" < ${add(new Date(campusDayStart(input.to, '结束日期') + DAY_MS))}`);
        }
        if (input.riderCustomerId != null && input.riderCustomerId !== '') {
            const riderId = Number(input.riderCustomerId);
            if (!Number.isFinite(riderId) || riderId <= 0)
                throw new core_1.UserInputError('骑手不存在');
            where.push(`e."riderCustomerId" = ${add(riderId)}`);
        }
        const status = String((_a = input.status) !== null && _a !== void 0 ? _a : '').trim();
        if (status && status !== 'ALL') {
            if (!['credited', 'pending', 'crediting'].includes(status))
                throw new core_1.UserInputError('分成状态不合法');
            where.push(`e.status = ${add(status)}`);
        }
        const code = String((_b = input.orderCode) !== null && _b !== void 0 ? _b : '').trim();
        if (code) {
            if (code.length > 64)
                throw new core_1.UserInputError('订单号过长');
            if (/^\d+$/.test(code)) {
                where.push(`e."orderId" = ${add(Number(code))}`);
            }
            else {
                where.push(`o.code ILIKE ${add(`%${code}%`)}`);
            }
        }
        const safeSkip = Math.max(0, Number((_c = input.skip) !== null && _c !== void 0 ? _c : 0) || 0);
        const safeTake = Math.min(Math.max(Number((_d = input.take) !== null && _d !== void 0 ? _d : 20) || 20, 1), 200);
        const whereSql = where.join(' AND ');
        const [summaryRows, itemRows] = await Promise.all([
            this.connection.rawConnection.query('SELECT COALESCE(SUM(e.amount), 0)::int AS "sumAmount", '
                + 'COALESCE(SUM(e.tip), 0)::int AS "sumTip", COUNT(*)::int AS total '
                + `FROM rider_earning e LEFT JOIN "order" o ON o.id = e."orderId" WHERE ${whereSql}`, params),
            this.connection.rawConnection.query('SELECT e.id, e."orderId", o.code AS "orderCode", e."riderCustomerId", '
                + 'e.amount, e.tip, e.status, e."createdAt" '
                + `FROM rider_earning e LEFT JOIN "order" o ON o.id = e."orderId" WHERE ${whereSql} `
                + 'ORDER BY e."createdAt" DESC, e.id DESC LIMIT $' + (params.length + 1)
                + ' OFFSET $' + (params.length + 2), [...params, safeTake, safeSkip]),
        ]);
        const summary = (_e = rowsOf(summaryRows)[0]) !== null && _e !== void 0 ? _e : {};
        const rows = rowsOf(itemRows);
        const nameOf = await this.riderNames(ctx, rows.map(r => Number(r.riderCustomerId)));
        return {
            items: rows.map(r => {
                var _a, _b, _c, _d, _e;
                return ({
                    id: String(r.id),
                    orderId: String(r.orderId),
                    orderCode: (_a = r.orderCode) !== null && _a !== void 0 ? _a : null,
                    riderCustomerId: String(r.riderCustomerId),
                    riderName: (_b = nameOf.get(Number(r.riderCustomerId))) !== null && _b !== void 0 ? _b : '骑手',
                    amount: Number((_c = r.amount) !== null && _c !== void 0 ? _c : 0),
                    tip: Number((_d = r.tip) !== null && _d !== void 0 ? _d : 0),
                    status: String((_e = r.status) !== null && _e !== void 0 ? _e : ''),
                    createdAt: r.createdAt,
                });
            }),
            total: Number((_f = summary.total) !== null && _f !== void 0 ? _f : 0),
            sumAmount: Number((_g = summary.sumAmount) !== null && _g !== void 0 ? _g : 0),
            sumTip: Number((_h = summary.sumTip) !== null && _h !== void 0 ? _h : 0),
        };
    }
    /** 订单维度轨迹：传订单 ID 或订单号（#A1024）均可，单趟配送完整点位（升序） */
    async orderTrack(ctx, orderId, orderCode) {
        var _a, _b;
        let id = Number(orderId);
        if (!Number.isFinite(id) || id <= 0) {
            const code = String(orderCode !== null && orderCode !== void 0 ? orderCode : '').trim();
            if (!code)
                throw new core_1.UserInputError('请输入订单号或订单 ID');
            if (code.length > 64)
                throw new core_1.UserInputError('订单号过长');
            const found = await this.connection.rawConnection.query('SELECT o.id FROM "order" o JOIN "order_channels_channel" oc ON oc."orderId" = o.id '
                + 'WHERE oc."channelId" = $1 AND o.code = $2 LIMIT 1', [ctx.channelId, code]);
            id = Number((_b = (_a = rowsOf(found)[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : NaN);
            if (!Number.isFinite(id) || id <= 0)
                throw new core_1.UserInputError('订单不存在或不属于当前店铺');
        }
        const res = await this.connection.rawConnection.query('SELECT l.id, l."orderId", o.code AS "orderCode", l."riderCustomerId", l.lat, l.lng, l."reportedAt" '
            + 'FROM campus_rider_location l LEFT JOIN "order" o ON o.id = l."orderId" '
            + 'WHERE l."orderId" = $1 AND l."channelId" = $2 '
            + 'ORDER BY l."reportedAt" ASC, l.id ASC LIMIT $3', [id, ctx.channelId, MAX_TRACK_POINTS]);
        return this.toTrack(ctx, rowsOf(res), { orderId: String(id) });
    }
    /** 骑手时段轨迹：骑手 + 东八区自然日区间（含结束日）跨单点位，按时间升序 */
    async riderTrack(ctx, riderCustomerId, from, to) {
        var _a;
        const riderId = Number(riderCustomerId);
        if (!Number.isFinite(riderId) || riderId <= 0)
            throw new core_1.UserInputError('骑手不存在');
        const start = campusDayStart(from, '开始日期');
        const end = campusDayStart(to, '结束日期') + DAY_MS;
        if (end <= start)
            throw new core_1.UserInputError('结束日期不能早于开始日期');
        if (end - start > 31 * DAY_MS)
            throw new core_1.UserInputError('查询区间不能超过 31 天');
        const res = await this.connection.rawConnection.query('SELECT l.id, l."orderId", o.code AS "orderCode", l."riderCustomerId", l.lat, l.lng, l."reportedAt" '
            + 'FROM campus_rider_location l LEFT JOIN "order" o ON o.id = l."orderId" '
            + 'WHERE l."channelId" = $1 AND l."riderCustomerId" = $2 '
            + 'AND l."reportedAt" >= $3 AND l."reportedAt" < $4 '
            + 'ORDER BY l."reportedAt" ASC, l.id ASC LIMIT $5', [ctx.channelId, riderId, new Date(start), new Date(end), MAX_TRACK_POINTS]);
        const rows = rowsOf(res);
        const track = await this.toTrack(ctx, rows, { riderCustomerId: String(riderId) });
        return Object.assign(Object.assign({}, track), { riderName: (_a = (await this.riderNames(ctx, [riderId])).get(riderId)) !== null && _a !== void 0 ? _a : '骑手' });
    }
    async toTrack(ctx, rows, extra) {
        var _a, _b, _c, _d, _e;
        const points = rows.map(r => {
            var _a;
            return ({
                id: String(r.id),
                orderId: String(r.orderId),
                orderCode: (_a = r.orderCode) !== null && _a !== void 0 ? _a : null,
                riderCustomerId: String(r.riderCustomerId),
                lat: Number(r.lat),
                lng: Number(r.lng),
                reportedAt: r.reportedAt,
            });
        });
        let distance = 0;
        for (let i = 1; i < points.length; i++)
            distance += haversineMeters(points[i - 1], points[i]);
        const riderCustomerId = (_c = (_b = (_a = points[0]) === null || _a === void 0 ? void 0 : _a.riderCustomerId) !== null && _b !== void 0 ? _b : extra.riderCustomerId) !== null && _c !== void 0 ? _c : null;
        return Object.assign(Object.assign({}, extra), { riderCustomerId, orderCode: (_e = (_d = points[0]) === null || _d === void 0 ? void 0 : _d.orderCode) !== null && _e !== void 0 ? _e : null, points, distanceMeters: Math.round(distance), truncated: rows.length >= MAX_TRACK_POINTS });
    }
    async riderNames(ctx, ids) {
        const unique = [...new Set(ids.filter(n => Number.isFinite(n) && n > 0))];
        if (!unique.length)
            return new Map();
        const riders = await this.connection.getRepository(ctx, core_1.Customer).findByIds(unique);
        return new Map(riders.map(c => {
            var _a;
            return [
                Number(c.id),
                (((_a = c.customFields) === null || _a === void 0 ? void 0 : _a.riderRealName) || c.firstName || '骑手'),
            ];
        }));
    }
};
exports.RiderLedgerService = RiderLedgerService;
exports.RiderLedgerService = RiderLedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], RiderLedgerService);
//# sourceMappingURL=rider-ledger.service.js.map