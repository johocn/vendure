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
import { CampusRiderAppeal, CampusBlacklist, CampusSupportTicket } from './support.entities';
import { RiderCreditService } from './rider-credit.service';

export const TICKET_CATEGORIES = ['order', 'delivery', 'refund', 'invoice', 'other'];
export const TICKET_STATUSES = ['open', 'replied', 'closed'];
export const APPEAL_STATUSES = ['pending', 'approved', 'rejected'];
const MAX_CONTENT = 500;
const MAX_REPLY = 500;
const MAX_IMAGES = 6;
const MAX_TAKE = 200;

function clampSkip(v?: number) {
    return Math.max(0, Number(v ?? 0) || 0);
}
function clampTake(v?: number) {
    const n = Number(v ?? 50) || 50;
    return Math.min(Math.max(n, 1), MAX_TAKE);
}
function normalizeImages(images?: string[] | null): string[] {
    const list = (images ?? []).map(v => String(v ?? '').trim()).filter(Boolean);
    if (list.length > MAX_IMAGES) throw new UserInputError(`最多上传 ${MAX_IMAGES} 张图片`);
    return list;
}

/**
 * 客服工单 + 骑手申诉 + 下单黑名单（站内留言制，非实时 IM）。
 * C 端（shop-api）只操作自己的记录；后台（admin-api）按当前渠道隔离处理。
 */
@Injectable()
export class SupportService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private credit: RiderCreditService,
    ) {}

    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) throw new ForbiddenError();
        return customer;
    }

    // ---------------- 客服工单 ----------------

    async createTicket(
        ctx: RequestContext,
        input: { category: string; content: string; images?: string[] | null; orderCode?: string | null },
    ) {
        const customer = await this.requireCustomer(ctx);
        const category = String(input.category ?? '');
        if (!TICKET_CATEGORIES.includes(category)) throw new UserInputError('工单类型不合法');
        const content = String(input.content ?? '').trim();
        if (!content) throw new UserInputError('请填写问题描述');
        if (content.length > MAX_CONTENT) throw new UserInputError(`问题描述不能超过 ${MAX_CONTENT} 个字符`);
        const orderCode = input.orderCode == null ? null : String(input.orderCode).trim() || null;
        const ticket = await this.connection.getRepository(ctx, CampusSupportTicket).save({
            channelId: ctx.channelId,
            customerId: customer.id,
            orderCode,
            category,
            content,
            images: normalizeImages(input.images),
            status: 'open',
        } as any);
        return ticket;
    }

    async myTickets(ctx: RequestContext, skip?: number, take?: number) {
        const customer = await this.requireCustomer(ctx);
        return this.connection.getRepository(ctx, CampusSupportTicket).find({
            where: { customerId: customer.id as any, channelId: ctx.channelId as any },
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
    }

    async adminTickets(ctx: RequestContext, status?: string, skip?: number, take?: number) {
        const where: Record<string, unknown> = { channelId: ctx.channelId };
        if (status) {
            if (!TICKET_STATUSES.includes(status)) throw new UserInputError('工单状态不合法');
            where.status = status;
        }
        const [items, total] = await this.connection.getRepository(ctx, CampusSupportTicket).findAndCount({
            where: where as any,
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
        const customers = items.length
            ? await this.connection.getRepository(ctx, Customer).findByIds(items.map(i => String(i.customerId)) as any)
            : [];
        const byId = new Map(customers.map(c => [String(c.id), c]));
        return {
            items: items.map(t => {
                const c = byId.get(String(t.customerId));
                return {
                    ...t,
                    customerName: [c?.firstName, c?.lastName].filter(Boolean).join(' ') || '-',
                    customerPhone: c?.phoneNumber ?? null,
                };
            }),
            total,
        };
    }

    /** 运营回复（replied）/ 关闭（closed）；回复内容必填（关闭时可选沿用原回复） */
    async replyTicket(ctx: RequestContext, id: ID, reply: string | undefined, status?: string) {
        const target = String(status ?? 'replied');
        if (!['replied', 'closed'].includes(target)) throw new UserInputError('工单状态不合法');
        const ticket = await this.connection.getRepository(ctx, CampusSupportTicket).findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        if (!ticket) throw new UserInputError('工单不存在或不属于当前店铺');
        const text = String(reply ?? '').trim();
        if (target === 'replied' && !text) throw new UserInputError('请填写回复内容');
        if (text.length > MAX_REPLY) throw new UserInputError(`回复不能超过 ${MAX_REPLY} 个字符`);
        await this.connection.getRepository(ctx, CampusSupportTicket).update(ticket.id, {
            status: target,
            reply: text || ticket.reply,
            repliedBy: String(ctx.activeUserId ?? ''),
            repliedAt: new Date(),
        } as any);
        return { ...ticket, status: target, reply: text || ticket.reply };
    }

    // ---------------- 骑手申诉 ----------------

    async createAppeal(
        ctx: RequestContext,
        input: { orderId?: ID | null; reason: string; images?: string[] | null },
    ) {
        const customer = await this.requireCustomer(ctx);
        if (String((customer.customFields as any)?.riderStatus ?? '') !== 'approved') throw new ForbiddenError();
        const reason = String(input.reason ?? '').trim();
        if (!reason) throw new UserInputError('请填写申诉理由');
        if (reason.length > MAX_CONTENT) throw new UserInputError(`申诉理由不能超过 ${MAX_CONTENT} 个字符`);
        let orderId: number | null = null;
        let orderCode: string | null = null;
        if (input.orderId != null && input.orderId !== '') {
            const order = await this.connection.getRepository(ctx, Order).findOne({
                where: { id: input.orderId as any },
            });
            // 只允许对本人配送过的订单申诉（防越权查看/关联他人订单）
            if (!order || String((order.customFields as any)?.deliveryStaffId ?? '') !== String(customer.id)) {
                throw new UserInputError('订单不存在或不属于本人配送');
            }
            orderId = Number(order.id);
            orderCode = order.code;
        }
        const pending = await this.connection.getRepository(ctx, CampusRiderAppeal).findOne({
            where: { riderCustomerId: customer.id as any, status: 'pending' as any },
        });
        if (pending) throw new UserInputError('已有待审核的申诉，请等待处理');
        return this.connection.getRepository(ctx, CampusRiderAppeal).save({
            channelId: ctx.channelId,
            riderCustomerId: customer.id,
            orderId,
            orderCode,
            reason,
            images: normalizeImages(input.images),
            status: 'pending',
            creditDelta: 0,
        } as any);
    }

    async myAppeals(ctx: RequestContext, skip?: number, take?: number) {
        const customer = await this.requireCustomer(ctx);
        return this.connection.getRepository(ctx, CampusRiderAppeal).find({
            where: { riderCustomerId: customer.id as any, channelId: ctx.channelId as any },
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
    }

    async adminAppeals(ctx: RequestContext, status?: string, skip?: number, take?: number) {
        const where: Record<string, unknown> = { channelId: ctx.channelId };
        if (status) {
            if (!APPEAL_STATUSES.includes(status)) throw new UserInputError('申诉状态不合法');
            where.status = status;
        }
        const [items, total] = await this.connection.getRepository(ctx, CampusRiderAppeal).findAndCount({
            where: where as any,
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
        const customers = items.length
            ? await this.connection.getRepository(ctx, Customer).findByIds(items.map(i => String(i.riderCustomerId)) as any)
            : [];
        const byId = new Map(customers.map(c => [String(c.id), c]));
        return {
            items: items.map(a => {
                const c = byId.get(String(a.riderCustomerId));
                return {
                    ...a,
                    riderName: (c?.customFields as any)?.riderRealName ?? c?.firstName ?? '-',
                    riderPhone: c?.phoneNumber ?? null,
                };
            }),
            total,
        };
    }

    /** 审核申诉：通过则按 creditDelta 回补信用分（默认 10），拒绝不回补 */
    async reviewAppeal(
        ctx: RequestContext,
        id: ID,
        approve: boolean,
        creditDelta?: number | null,
        note?: string | null,
    ) {
        const appeal = await this.connection.getRepository(ctx, CampusRiderAppeal).findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        if (!appeal) throw new UserInputError('申诉不存在或不属于当前店铺');
        if (appeal.status !== 'pending') throw new UserInputError('该申诉已处理');
        const delta = approve ? Math.min(20, Math.max(1, Number(creditDelta ?? 10) || 10)) : 0;
        await this.connection.getRepository(ctx, CampusRiderAppeal).update(appeal.id, {
            status: approve ? 'approved' : 'rejected',
            creditDelta: delta,
            reviewNote: String(note ?? '').trim() || null,
            reviewedBy: String(ctx.activeUserId ?? ''),
            reviewedAt: new Date(),
        } as any);
        if (delta > 0) {
            await this.credit.adjust(ctx, appeal.riderCustomerId as any, delta, 'appeal_approved', appeal.orderId ?? undefined);
        }
        return { ...appeal, status: approve ? 'approved' : 'rejected', creditDelta: delta };
    }

    // ---------------- 黑名单 ----------------

    async listBlacklist(ctx: RequestContext, skip?: number, take?: number) {
        const [items, total] = await this.connection.getRepository(ctx, CampusBlacklist).findAndCount({
            where: { channelId: ctx.channelId as any },
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
        return { items, total };
    }

    async addBlacklist(ctx: RequestContext, input: { type: string; value: string; reason?: string | null }) {
        const type = String(input.type ?? '');
        if (!['user', 'phone'].includes(type)) throw new UserInputError('黑名单类型不合法');
        const raw = String(input.value ?? '').trim();
        if (!raw) throw new UserInputError('请填写用户 ID 或手机号');
        let customerId: number | null = null;
        let phone: string | null = null;
        if (type === 'user') {
            customerId = Number(raw);
            if (!Number.isFinite(customerId) || customerId <= 0) throw new UserInputError('用户 ID 不合法');
            const inChannel = await this.connection.getRepository(ctx, Customer).createQueryBuilder('customer')
                .leftJoin('customer.channels', 'channel')
                .where('customer.id = :id', { id: customerId })
                .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
                .getOne();
            if (!inChannel) throw new UserInputError('用户不存在或不属于当前店铺');
        } else {
            phone = raw.replace(/[^\d+]/g, '');
            if (phone.length < 6 || phone.length > 20) throw new UserInputError('手机号不合法');
        }
        const exists = await this.connection.getRepository(ctx, CampusBlacklist).findOne({
            where: {
                channelId: ctx.channelId as any,
                type,
                ...(type === 'user' ? { customerId: customerId as any } : { phone: phone as any }),
            } as any,
        });
        if (exists) {
            if (exists.active) throw new UserInputError('该用户/手机号已在黑名单');
            await this.connection.getRepository(ctx, CampusBlacklist).update(exists.id, {
                active: true,
                reason: String(input.reason ?? '').trim() || null,
            } as any);
            return { ...exists, active: true };
        }
        return this.connection.getRepository(ctx, CampusBlacklist).save({
            channelId: ctx.channelId,
            type,
            customerId,
            phone,
            reason: String(input.reason ?? '').trim() || null,
            createdBy: String(ctx.activeUserId ?? ''),
            active: true,
        } as any);
    }

    async removeBlacklist(ctx: RequestContext, id: ID) {
        const row = await this.connection.getRepository(ctx, CampusBlacklist).findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        if (!row) throw new UserInputError('记录不存在或不属于当前店铺');
        await this.connection.getRepository(ctx, CampusBlacklist).delete(row.id);
        return { ok: true };
    }
}
