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
exports.RiderOpsService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_time_1 = require("./campus-time");
const rider_ops_entities_1 = require("./rider-ops.entities");
const DAY_MS = 24 * 3600000;
const MAX_TAKE = 500;
function clampTake(v) {
    const n = Number(v !== null && v !== void 0 ? v : 200) || 200;
    return Math.min(Math.max(n, 1), MAX_TAKE);
}
/** HH:mm 校验并转分钟 */
function toMinutes(hm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm !== null && hm !== void 0 ? hm : '').trim());
    if (!m)
        return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 24 || mi > 59)
        return null;
    return h * 60 + mi;
}
function hoursBetween(start, end) {
    return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3600000);
}
/**
 * 骑手运营域：排班、在线会话/在线时长、用户评分、配送导航坐标。
 * 会话由 RiderService（上下线/心跳）写入，运力预警 job 关闭超时会话。
 */
let RiderOpsService = class RiderOpsService {
    constructor(connection, customerService) {
        this.connection = connection;
        this.customerService = customerService;
    }
    async requireCustomer(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.ForbiddenError();
        return customer;
    }
    // ---------------- 在线会话 ----------------
    /** 上线开新会话（已有进行中会话则只续心跳）；下线关闭会话并落分钟数 */
    async touchSession(ctx, riderCustomerId, online) {
        const repo = this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderSession);
        const open = await repo.findOne({
            where: { riderCustomerId: riderCustomerId, channelId: ctx.channelId, endedAt: null },
            order: { id: 'DESC' },
        });
        const now = new Date();
        if (online) {
            if (open) {
                await repo.update(open.id, { lastHeartbeatAt: now });
            }
            else {
                await repo.save({
                    channelId: ctx.channelId,
                    riderCustomerId,
                    startedAt: now,
                    lastHeartbeatAt: now,
                });
            }
            return;
        }
        if (open) {
            const minutes = Math.max(1, Math.round(hoursBetween(open.startedAt, now) * 60));
            await repo.update(open.id, { endedAt: now, lastHeartbeatAt: now, minutes });
        }
    }
    /** 心跳：无进行中会话时补开（历史在线骑手跨版本升级后仍能计入时长） */
    async heartbeatSession(ctx, riderCustomerId) {
        await this.touchSession(ctx, riderCustomerId, true);
    }
    /** 按日统计在线时长（分钟）：会话与当日窗口取交集 */
    async onlineStats(ctx, date) {
        var _a;
        const dayStart = (0, campus_time_1.startOfCampusDay)(date ? new Date(`${date}T00:00:00+08:00`).getTime() : Date.now());
        const dayEnd = dayStart + DAY_MS;
        const sessions = await this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderSession).find({
            where: { channelId: ctx.channelId },
        });
        const now = Date.now();
        const byRider = new Map();
        for (const s of sessions) {
            const start = new Date(s.startedAt).getTime();
            const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
            const overlap = Math.min(end, dayEnd) - Math.max(start, dayStart);
            if (overlap <= 0)
                continue;
            const id = Number(s.riderCustomerId);
            byRider.set(id, ((_a = byRider.get(id)) !== null && _a !== void 0 ? _a : 0) + overlap / 60000);
        }
        const riders = await this.connection.getRepository(ctx, core_1.Customer).findByIds([...byRider.keys()].map(String));
        const nameOf = new Map(riders.map(c => { var _a, _b, _c; return [String(c.id), (_c = (_b = (_a = c.customFields) === null || _a === void 0 ? void 0 : _a.riderRealName) !== null && _b !== void 0 ? _b : c.firstName) !== null && _c !== void 0 ? _c : '-']; }));
        return {
            date: new Date(dayStart + campus_time_1.CAMPUS_TZ_OFFSET_MS).toISOString().slice(0, 10),
            items: [...byRider.entries()]
                .map(([riderCustomerId, minutes]) => {
                var _a;
                return ({
                    riderCustomerId,
                    realName: (_a = nameOf.get(String(riderCustomerId))) !== null && _a !== void 0 ? _a : '-',
                    onlineMinutes: Math.round(minutes),
                });
            })
                .sort((a, b) => b.onlineMinutes - a.onlineMinutes),
        };
    }
    // ---------------- 排班 ----------------
    async saveShift(ctx, input) {
        var _a, _b;
        const riderCustomerId = Number(input.riderCustomerId);
        const shiftDate = String((_a = input.shiftDate) !== null && _a !== void 0 ? _a : '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate))
            throw new core_1.UserInputError('班次日期格式应为 YYYY-MM-DD');
        const start = toMinutes(input.startTime);
        const end = toMinutes(input.endTime);
        if (start == null || end == null)
            throw new core_1.UserInputError('班次时间格式应为 HH:mm');
        if (end <= start)
            throw new core_1.UserInputError('结束时间必须晚于开始时间');
        const inChannel = await this.connection.getRepository(ctx, core_1.Customer).createQueryBuilder('customer')
            .leftJoin('customer.channels', 'channel')
            .where('customer.id = :id', { id: riderCustomerId })
            .andWhere('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('customer.customFields.riderStatus = :s', { s: 'approved' })
            .getOne();
        if (!inChannel)
            throw new core_1.UserInputError('骑手不存在或未通过审核');
        const repo = this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderShift);
        const payload = {
            channelId: ctx.channelId,
            riderCustomerId,
            shiftDate,
            startTime: String(input.startTime).trim(),
            endTime: String(input.endTime).trim(),
            note: String((_b = input.note) !== null && _b !== void 0 ? _b : '').trim() || null,
        };
        if (input.id != null && input.id !== '') {
            const row = await repo.findOne({ where: { id: input.id, channelId: ctx.channelId } });
            if (!row)
                throw new core_1.UserInputError('班次不存在或不属于当前店铺');
            await repo.update(row.id, payload);
            return Object.assign(Object.assign({}, row), payload);
        }
        const duplicate = await repo.findOne({
            where: {
                channelId: ctx.channelId,
                riderCustomerId: riderCustomerId,
                shiftDate: shiftDate,
                startTime: payload.startTime,
            },
        });
        if (duplicate) {
            await repo.update(duplicate.id, payload);
            return Object.assign(Object.assign({}, duplicate), payload);
        }
        return repo.save(payload);
    }
    async deleteShift(ctx, id) {
        const row = await this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderShift).findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        if (!row)
            throw new core_1.UserInputError('班次不存在或不属于当前店铺');
        await this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderShift).delete(row.id);
        return { ok: true };
    }
    async listShifts(ctx, date) {
        const shiftDate = String(date !== null && date !== void 0 ? date : '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate))
            throw new core_1.UserInputError('日期格式应为 YYYY-MM-DD');
        const [rows, stats] = await Promise.all([
            this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderShift).find({
                where: { channelId: ctx.channelId, shiftDate: shiftDate },
                order: { startTime: 'ASC' },
            }),
            this.onlineStats(ctx, shiftDate),
        ]);
        const riders = rows.length
            ? await this.connection.getRepository(ctx, core_1.Customer).findByIds(rows.map(r => String(r.riderCustomerId)))
            : [];
        const nameOf = new Map(riders.map(c => { var _a, _b, _c; return [String(c.id), (_c = (_b = (_a = c.customFields) === null || _a === void 0 ? void 0 : _a.riderRealName) !== null && _b !== void 0 ? _b : c.firstName) !== null && _c !== void 0 ? _c : '-']; }));
        return {
            date: shiftDate,
            items: rows.map(r => {
                var _a, _b, _c, _d;
                const stat = stats.items.find(s => String(s.riderCustomerId) === String(r.riderCustomerId));
                return Object.assign(Object.assign({}, r), { realName: (_a = nameOf.get(String(r.riderCustomerId))) !== null && _a !== void 0 ? _a : '-', onlineMinutes: (_b = stat === null || stat === void 0 ? void 0 : stat.onlineMinutes) !== null && _b !== void 0 ? _b : 0, shiftMinutes: Math.max(0, ((_c = toMinutes(r.endTime)) !== null && _c !== void 0 ? _c : 0) - ((_d = toMinutes(r.startTime)) !== null && _d !== void 0 ? _d : 0)) });
            }),
        };
    }
    /** 骑手端：我的班次（日期区间） */
    async myShifts(ctx, from, to) {
        const customer = await this.requireCustomer(ctx);
        const qb = this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderShift).createQueryBuilder('shift')
            .where('shift.channelId = :ch', { ch: ctx.channelId })
            .andWhere('shift.riderCustomerId = :id', { id: customer.id });
        if (from)
            qb.andWhere('shift.shiftDate >= :from', { from });
        if (to)
            qb.andWhere('shift.shiftDate <= :to', { to });
        return qb.orderBy('shift.shiftDate', 'ASC').addOrderBy('shift.startTime', 'ASC').take(clampTake(60)).getMany();
    }
    // ---------------- 用户评分 ----------------
    async createReview(ctx, orderId, rating, tags, comment) {
        var _a, _b, _c, _d;
        const customer = await this.requireCustomer(ctx);
        const score = Number(rating);
        if (!Number.isInteger(score) || score < 1 || score > 5)
            throw new core_1.UserInputError('评分应为 1-5 星');
        const tagList = (tags !== null && tags !== void 0 ? tags : []).map(t => String(t !== null && t !== void 0 ? t : '').trim()).filter(Boolean);
        if (tagList.length > 6 || tagList.some(t => t.length > 12))
            throw new core_1.UserInputError('评价标签不合法');
        const text = String(comment !== null && comment !== void 0 ? comment : '').trim();
        if (text.length > 200)
            throw new core_1.UserInputError('评价内容不能超过 200 个字符');
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['customer'],
        });
        if (!order)
            throw new core_1.UserInputError('订单不存在');
        // 仅下单人本人可评价（以 customerId 比对，避免依赖 customer.user 关系加载）
        if (String((_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '') !== String(customer.id))
            throw new core_1.ForbiddenError();
        const cf = ((_c = order.customFields) !== null && _c !== void 0 ? _c : {});
        if (cf.deliveryStatus !== 'delivered' && cf.hallStatus !== 'delivered') {
            throw new core_1.UserInputError('订单送达后才能评价骑手');
        }
        const riderCustomerId = Number((_d = cf.deliveryStaffId) !== null && _d !== void 0 ? _d : NaN);
        if (!riderCustomerId)
            throw new core_1.UserInputError('该订单无配送骑手');
        const repo = this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderReview);
        const existing = await repo.findOne({
            where: { orderId: Number(order.id), channelId: ctx.channelId },
        });
        if (existing) {
            await repo.update(existing.id, { rating: score, tags: tagList, comment: text || null });
            return Object.assign(Object.assign({}, existing), { rating: score, tags: tagList, comment: text || null });
        }
        return repo.save({
            channelId: ctx.channelId,
            riderCustomerId,
            orderId: Number(order.id),
            rating: score,
            tags: tagList,
            comment: text || null,
        });
    }
    /** 评分汇总：不传 riderCustomerId = 当前登录骑手自己 */
    async ratingStats(ctx, riderCustomerId) {
        var _a, _b;
        let riderId;
        if (riderCustomerId != null && riderCustomerId !== '') {
            riderId = Number(riderCustomerId);
        }
        else {
            riderId = Number((await this.requireCustomer(ctx)).id);
        }
        const raw = await this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderReview).createQueryBuilder('r')
            .select('COALESCE(AVG(r.rating), 0)', 'avg')
            .addSelect('COUNT(*)', 'count')
            .where('r."riderCustomerId" = :id', { id: riderId })
            .andWhere('r."channelId" = :ch', { ch: ctx.channelId })
            .getRawOne();
        const avg = Number((_a = raw === null || raw === void 0 ? void 0 : raw.avg) !== null && _a !== void 0 ? _a : 0);
        return {
            riderCustomerId: riderId,
            avgRating: Math.round(avg * 10) / 10,
            ratingCount: Number((_b = raw === null || raw === void 0 ? void 0 : raw.count) !== null && _b !== void 0 ? _b : 0),
        };
    }
    async adminReviews(ctx, riderCustomerId, skip, take) {
        const where = { channelId: ctx.channelId };
        if (riderCustomerId != null && riderCustomerId !== '')
            where.riderCustomerId = Number(riderCustomerId);
        return this.connection.getRepository(ctx, rider_ops_entities_1.CampusRiderReview).find({
            where: where,
            order: { createdAt: 'DESC' },
            skip: Math.max(0, Number(skip !== null && skip !== void 0 ? skip : 0) || 0),
            take: clampTake(take),
        });
    }
    // ---------------- 导航坐标 ----------------
    /** 骑手配送导航：店铺取货点 + 收货楼栋坐标（gcj02），供 uni.openLocation 使用 */
    async riderNav(ctx, orderId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
        const customer = await this.requireCustomer(ctx);
        if (String((_b = (_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.riderStatus) !== null && _b !== void 0 ? _b : '') !== 'approved')
            throw new core_1.ForbiddenError();
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['channels'],
        });
        const cf = ((_c = order === null || order === void 0 ? void 0 : order.customFields) !== null && _c !== void 0 ? _c : {});
        if (!order || String((_d = cf.deliveryStaffId) !== null && _d !== void 0 ? _d : '') !== String(customer.id))
            throw new core_1.ForbiddenError();
        if (!['assigned', 'in_progress'].includes(String((_e = cf.deliveryStatus) !== null && _e !== void 0 ? _e : ''))) {
            throw new core_1.UserInputError('当前状态不允许导航');
        }
        const orderChannelId = Number((_h = (_g = ((_f = order.channels) !== null && _f !== void 0 ? _f : [])[0]) === null || _g === void 0 ? void 0 : _g.id) !== null && _h !== void 0 ? _h : ctx.channelId);
        const cfg = await this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: orderChannelId },
        });
        let building = null;
        const buildingId = Number((_j = cf.buildingId) !== null && _j !== void 0 ? _j : NaN);
        if (buildingId) {
            building = await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findOne({
                where: { id: buildingId },
            });
        }
        return {
            orderId: order.id,
            orderCode: order.code,
            storeName: String((_m = (_l = ((_k = order.channels) !== null && _k !== void 0 ? _k : [])[0]) === null || _l === void 0 ? void 0 : _l.code) !== null && _m !== void 0 ? _m : ''),
            storeAddress: (_o = cfg === null || cfg === void 0 ? void 0 : cfg.storeAddress) !== null && _o !== void 0 ? _o : null,
            storePhone: (_p = cfg === null || cfg === void 0 ? void 0 : cfg.storePhone) !== null && _p !== void 0 ? _p : null,
            storeLat: (_q = cfg === null || cfg === void 0 ? void 0 : cfg.storeLat) !== null && _q !== void 0 ? _q : null,
            storeLng: (_r = cfg === null || cfg === void 0 ? void 0 : cfg.storeLng) !== null && _r !== void 0 ? _r : null,
            buildingName: (_s = building === null || building === void 0 ? void 0 : building.name) !== null && _s !== void 0 ? _s : null,
            buildingDetail: (_t = building === null || building === void 0 ? void 0 : building.detail) !== null && _t !== void 0 ? _t : ((_u = cf.deliveryDetail) !== null && _u !== void 0 ? _u : null),
            buildingLat: (_v = building === null || building === void 0 ? void 0 : building.lat) !== null && _v !== void 0 ? _v : null,
            buildingLng: (_w = building === null || building === void 0 ? void 0 : building.lng) !== null && _w !== void 0 ? _w : null,
            campusZone: (_x = cf.campusZone) !== null && _x !== void 0 ? _x : null,
            note: (_y = cf.note) !== null && _y !== void 0 ? _y : null,
            deliveryStatus: (_z = cf.deliveryStatus) !== null && _z !== void 0 ? _z : null,
        };
    }
};
exports.RiderOpsService = RiderOpsService;
exports.RiderOpsService = RiderOpsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService])
], RiderOpsService);
//# sourceMappingURL=rider-ops.service.js.map