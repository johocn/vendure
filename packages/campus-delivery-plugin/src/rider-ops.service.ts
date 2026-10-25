import { Injectable } from '@nestjs/common';
import {
    Customer,
    CustomerService,
    ForbiddenError,
    ID,
    Order,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CAMPUS_TZ_OFFSET_MS, startOfCampusDay } from './campus-time';
import { CampusRiderReview, CampusRiderSession, CampusRiderShift } from './rider-ops.entities';

const DAY_MS = 24 * 3600_000;
const MAX_TAKE = 500;

function clampTake(v?: number) {
    const n = Number(v ?? 200) || 200;
    return Math.min(Math.max(n, 1), MAX_TAKE);
}

/** HH:mm 校验并转分钟 */
function toMinutes(hm: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 24 || mi > 59) return null;
    return h * 60 + mi;
}

function hoursBetween(start: Date, end: Date): number {
    return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
}

/**
 * 骑手运营域：排班、在线会话/在线时长、用户评分、配送导航坐标。
 * 会话由 RiderService（上下线/心跳）写入，运力预警 job 关闭超时会话。
 */
@Injectable()
export class RiderOpsService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
    ) {}

    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) throw new ForbiddenError();
        return customer;
    }

    // ---------------- 在线会话 ----------------

    /** 上线开新会话（已有进行中会话则只续心跳）；下线关闭会话并落分钟数 */
    async touchSession(ctx: RequestContext, riderCustomerId: number, online: boolean): Promise<void> {
        const repo = this.connection.getRepository(ctx, CampusRiderSession);
        const open = await repo.findOne({
            where: { riderCustomerId: riderCustomerId as any, channelId: ctx.channelId as any, endedAt: null as any },
            order: { id: 'DESC' },
        });
        const now = new Date();
        if (online) {
            if (open) {
                await repo.update(open.id, { lastHeartbeatAt: now } as any);
            } else {
                await repo.save({
                    channelId: ctx.channelId,
                    riderCustomerId,
                    startedAt: now,
                    lastHeartbeatAt: now,
                } as any);
            }
            return;
        }
        if (open) {
            const minutes = Math.max(1, Math.round(hoursBetween(open.startedAt, now) * 60));
            await repo.update(open.id, { endedAt: now, lastHeartbeatAt: now, minutes } as any);
        }
    }

    /** 心跳：无进行中会话时补开（历史在线骑手跨版本升级后仍能计入时长） */
    async heartbeatSession(ctx: RequestContext, riderCustomerId: number): Promise<void> {
        await this.touchSession(ctx, riderCustomerId, true);
    }

    /** 按日统计在线时长（分钟）：会话与当日窗口取交集 */
    async onlineStats(ctx: RequestContext, date?: string) {
        const dayStart = startOfCampusDay(
            date ? new Date(`${date}T00:00:00+08:00`).getTime() : Date.now(),
        );
        const dayEnd = dayStart + DAY_MS;
        const sessions = await this.connection.getRepository(ctx, CampusRiderSession).find({
            where: { channelId: ctx.channelId as any },
        });
        const now = Date.now();
        const byRider = new Map<number, number>();
        for (const s of sessions) {
            const start = new Date(s.startedAt).getTime();
            const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
            const overlap = Math.min(end, dayEnd) - Math.max(start, dayStart);
            if (overlap <= 0) continue;
            const id = Number(s.riderCustomerId);
            byRider.set(id, (byRider.get(id) ?? 0) + overlap / 60_000);
        }
        const riders = await this.connection.getRepository(ctx, Customer).findByIds([...byRider.keys()].map(String) as any);
        const nameOf = new Map(
            riders.map(c => [String(c.id), (c.customFields as any)?.riderRealName ?? c.firstName ?? '-']),
        );
        return {
            date: new Date(dayStart + CAMPUS_TZ_OFFSET_MS).toISOString().slice(0, 10),
            items: [...byRider.entries()]
                .map(([riderCustomerId, minutes]) => ({
                    riderCustomerId,
                    realName: nameOf.get(String(riderCustomerId)) ?? '-',
                    onlineMinutes: Math.round(minutes),
                }))
                .sort((a, b) => b.onlineMinutes - a.onlineMinutes),
        };
    }

    // ---------------- 排班 ----------------

    async saveShift(
        ctx: RequestContext,
        input: { id?: ID | null; riderCustomerId: ID; shiftDate: string; startTime: string; endTime: string; note?: string | null },
    ) {
        const riderCustomerId = Number(input.riderCustomerId);
        const shiftDate = String(input.shiftDate ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) throw new UserInputError('班次日期格式应为 YYYY-MM-DD');
        const start = toMinutes(input.startTime);
        const end = toMinutes(input.endTime);
        if (start == null || end == null) throw new UserInputError('班次时间格式应为 HH:mm');
        if (end <= start) throw new UserInputError('结束时间必须晚于开始时间');
        const inChannel = await this.connection.getRepository(ctx, Customer).createQueryBuilder('customer')
            .leftJoin('customer.channels', 'channel')
            .where('customer.id = :id', { id: riderCustomerId })
            .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('customer.customFields.riderStatus = :s', { s: 'approved' })
            .getOne();
        if (!inChannel) throw new UserInputError('骑手不存在或未通过审核');
        const repo = this.connection.getRepository(ctx, CampusRiderShift);
        const payload = {
            channelId: ctx.channelId,
            riderCustomerId,
            shiftDate,
            startTime: String(input.startTime).trim(),
            endTime: String(input.endTime).trim(),
            note: String(input.note ?? '').trim() || null,
        };
        if (input.id != null && input.id !== '') {
            const row = await repo.findOne({ where: { id: input.id as any, channelId: ctx.channelId as any } });
            if (!row) throw new UserInputError('班次不存在或不属于当前店铺');
            await repo.update(row.id, payload as any);
            return { ...row, ...payload };
        }
        const duplicate = await repo.findOne({
            where: {
                channelId: ctx.channelId as any,
                riderCustomerId: riderCustomerId as any,
                shiftDate: shiftDate as any,
                startTime: payload.startTime as any,
            },
        });
        if (duplicate) {
            await repo.update(duplicate.id, payload as any);
            return { ...duplicate, ...payload };
        }
        return repo.save(payload as any);
    }

    async deleteShift(ctx: RequestContext, id: ID) {
        const row = await this.connection.getRepository(ctx, CampusRiderShift).findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        if (!row) throw new UserInputError('班次不存在或不属于当前店铺');
        await this.connection.getRepository(ctx, CampusRiderShift).delete(row.id);
        return { ok: true };
    }

    async listShifts(ctx: RequestContext, date: string) {
        const shiftDate = String(date ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) throw new UserInputError('日期格式应为 YYYY-MM-DD');
        const [rows, stats] = await Promise.all([
            this.connection.getRepository(ctx, CampusRiderShift).find({
                where: { channelId: ctx.channelId as any, shiftDate: shiftDate as any },
                order: { startTime: 'ASC' },
            }),
            this.onlineStats(ctx, shiftDate),
        ]);
        const riders = rows.length
            ? await this.connection.getRepository(ctx, Customer).findByIds(rows.map(r => String(r.riderCustomerId)) as any)
            : [];
        const nameOf = new Map(
            riders.map(c => [String(c.id), (c.customFields as any)?.riderRealName ?? c.firstName ?? '-']),
        );
        return {
            date: shiftDate,
            items: rows.map(r => {
                const stat = stats.items.find(s => String(s.riderCustomerId) === String(r.riderCustomerId));
                return {
                    ...r,
                    realName: nameOf.get(String(r.riderCustomerId)) ?? '-',
                    onlineMinutes: stat?.onlineMinutes ?? 0,
                    shiftMinutes: Math.max(0, (toMinutes(r.endTime) ?? 0) - (toMinutes(r.startTime) ?? 0)),
                };
            }),
        };
    }

    /** 骑手端：我的班次（日期区间） */
    async myShifts(ctx: RequestContext, from?: string, to?: string) {
        const customer = await this.requireCustomer(ctx);
        const qb = this.connection.getRepository(ctx, CampusRiderShift).createQueryBuilder('shift')
            .where('shift.channelId = :ch', { ch: ctx.channelId as any })
            .andWhere('shift.riderCustomerId = :id', { id: customer.id });
        if (from) qb.andWhere('shift.shiftDate >= :from', { from });
        if (to) qb.andWhere('shift.shiftDate <= :to', { to });
        return qb.orderBy('shift.shiftDate', 'ASC').addOrderBy('shift.startTime', 'ASC').take(clampTake(60)).getMany();
    }

    // ---------------- 用户评分 ----------------

    async createReview(
        ctx: RequestContext,
        orderId: ID,
        rating: number,
        tags?: string[] | null,
        comment?: string | null,
    ) {
        const customer = await this.requireCustomer(ctx);
        const score = Number(rating);
        if (!Number.isInteger(score) || score < 1 || score > 5) throw new UserInputError('评分应为 1-5 星');
        const tagList = (tags ?? []).map(t => String(t ?? '').trim()).filter(Boolean);
        if (tagList.length > 6 || tagList.some(t => t.length > 12)) throw new UserInputError('评价标签不合法');
        const text = String(comment ?? '').trim();
        if (text.length > 200) throw new UserInputError('评价内容不能超过 200 个字符');
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['customer'],
        });
        if (!order) throw new UserInputError('订单不存在');
        // 仅下单人本人可评价（以 customerId 比对，避免依赖 customer.user 关系加载）
        if (String(order.customer?.id ?? '') !== String(customer.id)) throw new ForbiddenError();
        const cf = (order.customFields ?? {}) as any;
        if (cf.deliveryStatus !== 'delivered' && cf.hallStatus !== 'delivered') {
            throw new UserInputError('订单送达后才能评价骑手');
        }
        const riderCustomerId = Number(cf.deliveryStaffId ?? NaN);
        if (!riderCustomerId) throw new UserInputError('该订单无配送骑手');
        const repo = this.connection.getRepository(ctx, CampusRiderReview);
        const existing = await repo.findOne({
            where: { orderId: Number(order.id) as any, channelId: ctx.channelId as any },
        });
        if (existing) {
            await repo.update(existing.id, { rating: score, tags: tagList, comment: text || null } as any);
            return { ...existing, rating: score, tags: tagList, comment: text || null };
        }
        return repo.save({
            channelId: ctx.channelId,
            riderCustomerId,
            orderId: Number(order.id),
            rating: score,
            tags: tagList,
            comment: text || null,
        } as any);
    }

    /** 评分汇总：不传 riderCustomerId = 当前登录骑手自己 */
    async ratingStats(ctx: RequestContext, riderCustomerId?: ID | null) {
        let riderId: number;
        if (riderCustomerId != null && riderCustomerId !== '') {
            riderId = Number(riderCustomerId);
        } else {
            riderId = Number((await this.requireCustomer(ctx)).id);
        }
        const raw: any = await this.connection.getRepository(ctx, CampusRiderReview).createQueryBuilder('r')
            .select('COALESCE(AVG(r.rating), 0)', 'avg')
            .addSelect('COUNT(*)', 'count')
            .where('r."riderCustomerId" = :id', { id: riderId })
            .andWhere('r."channelId" = :ch', { ch: ctx.channelId })
            .getRawOne();
        const avg = Number(raw?.avg ?? 0);
        return {
            riderCustomerId: riderId,
            avgRating: Math.round(avg * 10) / 10,
            ratingCount: Number(raw?.count ?? 0),
        };
    }

    /** 骑手查看自己的评价明细（P3-3）：仅返回当前登录骑手收到的评价 */
    async myReviews(ctx: RequestContext, skip?: number, take?: number) {
        const customer = await this.requireCustomer(ctx);
        return this.connection.getRepository(ctx, CampusRiderReview).find({
            where: {
                channelId: ctx.channelId as any,
                riderCustomerId: Number(customer.id) as any,
            },
            order: { createdAt: 'DESC' },
            skip: Math.max(0, Number(skip ?? 0) || 0),
            take: clampTake(take ?? 20),
        });
    }

    async adminReviews(ctx: RequestContext, riderCustomerId?: ID | null, skip?: number, take?: number) {
        const where: Record<string, unknown> = { channelId: ctx.channelId };
        if (riderCustomerId != null && riderCustomerId !== '') where.riderCustomerId = Number(riderCustomerId);
        return this.connection.getRepository(ctx, CampusRiderReview).find({
            where: where as any,
            order: { createdAt: 'DESC' },
            skip: Math.max(0, Number(skip ?? 0) || 0),
            take: clampTake(take),
        });
    }

    // ---------------- 导航坐标 ----------------

    /** 骑手配送导航：店铺取货点 + 收货楼栋坐标（gcj02），供 uni.openLocation 使用 */
    async riderNav(ctx: RequestContext, orderId: ID) {
        const customer = await this.requireCustomer(ctx);
        if (String((customer.customFields as any)?.riderStatus ?? '') !== 'approved') throw new ForbiddenError();
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const cf = (order?.customFields ?? {}) as any;
        if (!order || String(cf.deliveryStaffId ?? '') !== String(customer.id)) throw new ForbiddenError();
        if (!['assigned', 'in_progress'].includes(String(cf.deliveryStatus ?? ''))) {
            throw new UserInputError('当前状态不允许导航');
        }
        const orderChannelId = Number((order.channels ?? [])[0]?.id ?? ctx.channelId);
        const cfg = await this.connection.getRepository(ctx, CampusFulfillmentConfig).findOne({
            where: { channelId: orderChannelId as any },
        });
        let building: CampusBuilding | null = null;
        const buildingId = Number(cf.buildingId ?? NaN);
        if (buildingId) {
            building = await this.connection.getRepository(ctx, CampusBuilding).findOne({
                where: { id: buildingId as any },
            });
        }
        return {
            orderId: order.id,
            orderCode: order.code,
            storeName: String((order.channels ?? [])[0]?.code ?? ''),
            storeAddress: cfg?.storeAddress ?? null,
            storePhone: cfg?.storePhone ?? null,
            storeLat: cfg?.storeLat ?? null,
            storeLng: cfg?.storeLng ?? null,
            buildingName: building?.name ?? null,
            buildingDetail: building?.detail ?? (cf.deliveryDetail ?? null),
            buildingLat: building?.lat ?? null,
            buildingLng: building?.lng ?? null,
            campusZone: cf.campusZone ?? null,
            note: cf.note ?? null,
            deliveryStatus: cf.deliveryStatus ?? null,
        };
    }
}
