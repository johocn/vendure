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
exports.SupportService = exports.APPEAL_STATUSES = exports.TICKET_STATUSES = exports.TICKET_CATEGORIES = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const support_entities_1 = require("./support.entities");
const rider_credit_service_1 = require("./rider-credit.service");
exports.TICKET_CATEGORIES = ['order', 'delivery', 'refund', 'invoice', 'other'];
exports.TICKET_STATUSES = ['open', 'replied', 'closed'];
exports.APPEAL_STATUSES = ['pending', 'approved', 'rejected'];
const MAX_CONTENT = 500;
const MAX_REPLY = 500;
const MAX_IMAGES = 6;
const MAX_TAKE = 200;
function clampSkip(v) {
    return Math.max(0, Number(v !== null && v !== void 0 ? v : 0) || 0);
}
function clampTake(v) {
    const n = Number(v !== null && v !== void 0 ? v : 50) || 50;
    return Math.min(Math.max(n, 1), MAX_TAKE);
}
function normalizeImages(images) {
    const list = (images !== null && images !== void 0 ? images : []).map(v => String(v !== null && v !== void 0 ? v : '').trim()).filter(Boolean);
    if (list.length > MAX_IMAGES)
        throw new core_1.UserInputError(`最多上传 ${MAX_IMAGES} 张图片`);
    return list;
}
/**
 * 客服工单 + 骑手申诉 + 下单黑名单（站内留言制，非实时 IM）。
 * C 端（shop-api）只操作自己的记录；后台（admin-api）按当前渠道隔离处理。
 */
let SupportService = class SupportService {
    constructor(connection, customerService, credit) {
        this.connection = connection;
        this.customerService = customerService;
        this.credit = credit;
    }
    async requireCustomer(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.ForbiddenError();
        return customer;
    }
    // ---------------- 客服工单 ----------------
    async createTicket(ctx, input) {
        var _a, _b;
        const customer = await this.requireCustomer(ctx);
        const category = String((_a = input.category) !== null && _a !== void 0 ? _a : '');
        if (!exports.TICKET_CATEGORIES.includes(category))
            throw new core_1.UserInputError('工单类型不合法');
        const content = String((_b = input.content) !== null && _b !== void 0 ? _b : '').trim();
        if (!content)
            throw new core_1.UserInputError('请填写问题描述');
        if (content.length > MAX_CONTENT)
            throw new core_1.UserInputError(`问题描述不能超过 ${MAX_CONTENT} 个字符`);
        const orderCode = input.orderCode == null ? null : String(input.orderCode).trim() || null;
        const ticket = await this.connection.getRepository(ctx, support_entities_1.CampusSupportTicket).save({
            channelId: ctx.channelId,
            customerId: customer.id,
            orderCode,
            category,
            content,
            images: normalizeImages(input.images),
            status: 'open',
        });
        return ticket;
    }
    async myTickets(ctx, skip, take) {
        const customer = await this.requireCustomer(ctx);
        return this.connection.getRepository(ctx, support_entities_1.CampusSupportTicket).find({
            where: { customerId: customer.id, channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
    }
    async adminTickets(ctx, status, skip, take) {
        const where = { channelId: ctx.channelId };
        if (status) {
            if (!exports.TICKET_STATUSES.includes(status))
                throw new core_1.UserInputError('工单状态不合法');
            where.status = status;
        }
        const [items, total] = await this.connection.getRepository(ctx, support_entities_1.CampusSupportTicket).findAndCount({
            where: where,
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
        const customers = items.length
            ? await this.connection.getRepository(ctx, core_1.Customer).findByIds(items.map(i => String(i.customerId)))
            : [];
        const byId = new Map(customers.map(c => [String(c.id), c]));
        return {
            items: items.map(t => {
                var _a;
                const c = byId.get(String(t.customerId));
                return Object.assign(Object.assign({}, t), { customerName: [c === null || c === void 0 ? void 0 : c.firstName, c === null || c === void 0 ? void 0 : c.lastName].filter(Boolean).join(' ') || '-', customerPhone: (_a = c === null || c === void 0 ? void 0 : c.phoneNumber) !== null && _a !== void 0 ? _a : null });
            }),
            total,
        };
    }
    /** 运营回复（replied）/ 关闭（closed）；回复内容必填（关闭时可选沿用原回复） */
    async replyTicket(ctx, id, reply, status) {
        var _a;
        const target = String(status !== null && status !== void 0 ? status : 'replied');
        if (!['replied', 'closed'].includes(target))
            throw new core_1.UserInputError('工单状态不合法');
        const ticket = await this.connection.getRepository(ctx, support_entities_1.CampusSupportTicket).findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        if (!ticket)
            throw new core_1.UserInputError('工单不存在或不属于当前店铺');
        const text = String(reply !== null && reply !== void 0 ? reply : '').trim();
        if (target === 'replied' && !text)
            throw new core_1.UserInputError('请填写回复内容');
        if (text.length > MAX_REPLY)
            throw new core_1.UserInputError(`回复不能超过 ${MAX_REPLY} 个字符`);
        await this.connection.getRepository(ctx, support_entities_1.CampusSupportTicket).update(ticket.id, {
            status: target,
            reply: text || ticket.reply,
            repliedBy: String((_a = ctx.activeUserId) !== null && _a !== void 0 ? _a : ''),
            repliedAt: new Date(),
        });
        return Object.assign(Object.assign({}, ticket), { status: target, reply: text || ticket.reply });
    }
    // ---------------- 骑手申诉 ----------------
    async createAppeal(ctx, input) {
        var _a, _b, _c, _d, _e;
        const customer = await this.requireCustomer(ctx);
        if (String((_b = (_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.riderStatus) !== null && _b !== void 0 ? _b : '') !== 'approved')
            throw new core_1.ForbiddenError();
        const reason = String((_c = input.reason) !== null && _c !== void 0 ? _c : '').trim();
        if (!reason)
            throw new core_1.UserInputError('请填写申诉理由');
        if (reason.length > MAX_CONTENT)
            throw new core_1.UserInputError(`申诉理由不能超过 ${MAX_CONTENT} 个字符`);
        let orderId = null;
        let orderCode = null;
        if (input.orderId != null && input.orderId !== '') {
            const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
                where: { id: input.orderId },
            });
            // 只允许对本人配送过的订单申诉（防越权查看/关联他人订单）
            if (!order || String((_e = (_d = order.customFields) === null || _d === void 0 ? void 0 : _d.deliveryStaffId) !== null && _e !== void 0 ? _e : '') !== String(customer.id)) {
                throw new core_1.UserInputError('订单不存在或不属于本人配送');
            }
            orderId = Number(order.id);
            orderCode = order.code;
        }
        const pending = await this.connection.getRepository(ctx, support_entities_1.CampusRiderAppeal).findOne({
            where: { riderCustomerId: customer.id, status: 'pending' },
        });
        if (pending)
            throw new core_1.UserInputError('已有待审核的申诉，请等待处理');
        return this.connection.getRepository(ctx, support_entities_1.CampusRiderAppeal).save({
            channelId: ctx.channelId,
            riderCustomerId: customer.id,
            orderId,
            orderCode,
            reason,
            images: normalizeImages(input.images),
            status: 'pending',
            creditDelta: 0,
        });
    }
    async myAppeals(ctx, skip, take) {
        const customer = await this.requireCustomer(ctx);
        return this.connection.getRepository(ctx, support_entities_1.CampusRiderAppeal).find({
            where: { riderCustomerId: customer.id, channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
    }
    async adminAppeals(ctx, status, skip, take) {
        const where = { channelId: ctx.channelId };
        if (status) {
            if (!exports.APPEAL_STATUSES.includes(status))
                throw new core_1.UserInputError('申诉状态不合法');
            where.status = status;
        }
        const [items, total] = await this.connection.getRepository(ctx, support_entities_1.CampusRiderAppeal).findAndCount({
            where: where,
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
        const customers = items.length
            ? await this.connection.getRepository(ctx, core_1.Customer).findByIds(items.map(i => String(i.riderCustomerId)))
            : [];
        const byId = new Map(customers.map(c => [String(c.id), c]));
        return {
            items: items.map(a => {
                var _a, _b, _c, _d;
                const c = byId.get(String(a.riderCustomerId));
                return Object.assign(Object.assign({}, a), { riderName: (_c = (_b = (_a = c === null || c === void 0 ? void 0 : c.customFields) === null || _a === void 0 ? void 0 : _a.riderRealName) !== null && _b !== void 0 ? _b : c === null || c === void 0 ? void 0 : c.firstName) !== null && _c !== void 0 ? _c : '-', riderPhone: (_d = c === null || c === void 0 ? void 0 : c.phoneNumber) !== null && _d !== void 0 ? _d : null });
            }),
            total,
        };
    }
    /** 审核申诉：通过则按 creditDelta 回补信用分（默认 10），拒绝不回补 */
    async reviewAppeal(ctx, id, approve, creditDelta, note) {
        var _a, _b;
        const appeal = await this.connection.getRepository(ctx, support_entities_1.CampusRiderAppeal).findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        if (!appeal)
            throw new core_1.UserInputError('申诉不存在或不属于当前店铺');
        if (appeal.status !== 'pending')
            throw new core_1.UserInputError('该申诉已处理');
        const delta = approve ? Math.min(20, Math.max(1, Number(creditDelta !== null && creditDelta !== void 0 ? creditDelta : 10) || 10)) : 0;
        await this.connection.getRepository(ctx, support_entities_1.CampusRiderAppeal).update(appeal.id, {
            status: approve ? 'approved' : 'rejected',
            creditDelta: delta,
            reviewNote: String(note !== null && note !== void 0 ? note : '').trim() || null,
            reviewedBy: String((_a = ctx.activeUserId) !== null && _a !== void 0 ? _a : ''),
            reviewedAt: new Date(),
        });
        if (delta > 0) {
            await this.credit.adjust(ctx, appeal.riderCustomerId, delta, 'appeal_approved', (_b = appeal.orderId) !== null && _b !== void 0 ? _b : undefined);
        }
        return Object.assign(Object.assign({}, appeal), { status: approve ? 'approved' : 'rejected', creditDelta: delta });
    }
    // ---------------- 黑名单 ----------------
    async listBlacklist(ctx, skip, take) {
        const [items, total] = await this.connection.getRepository(ctx, support_entities_1.CampusBlacklist).findAndCount({
            where: { channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
            skip: clampSkip(skip),
            take: clampTake(take),
        });
        return { items, total };
    }
    async addBlacklist(ctx, input) {
        var _a, _b, _c, _d, _e;
        const type = String((_a = input.type) !== null && _a !== void 0 ? _a : '');
        if (!['user', 'phone'].includes(type))
            throw new core_1.UserInputError('黑名单类型不合法');
        const raw = String((_b = input.value) !== null && _b !== void 0 ? _b : '').trim();
        if (!raw)
            throw new core_1.UserInputError('请填写用户 ID 或手机号');
        let customerId = null;
        let phone = null;
        if (type === 'user') {
            customerId = Number(raw);
            if (!Number.isFinite(customerId) || customerId <= 0)
                throw new core_1.UserInputError('用户 ID 不合法');
            const inChannel = await this.connection.getRepository(ctx, core_1.Customer).createQueryBuilder('customer')
                .leftJoin('customer.channels', 'channel')
                .where('customer.id = :id', { id: customerId })
                .andWhere('channel.id = :ch', { ch: ctx.channelId })
                .getOne();
            if (!inChannel)
                throw new core_1.UserInputError('用户不存在或不属于当前店铺');
        }
        else {
            phone = raw.replace(/[^\d+]/g, '');
            if (phone.length < 6 || phone.length > 20)
                throw new core_1.UserInputError('手机号不合法');
        }
        const exists = await this.connection.getRepository(ctx, support_entities_1.CampusBlacklist).findOne({
            where: Object.assign({ channelId: ctx.channelId, type }, (type === 'user' ? { customerId: customerId } : { phone: phone })),
        });
        if (exists) {
            if (exists.active)
                throw new core_1.UserInputError('该用户/手机号已在黑名单');
            await this.connection.getRepository(ctx, support_entities_1.CampusBlacklist).update(exists.id, {
                active: true,
                reason: String((_c = input.reason) !== null && _c !== void 0 ? _c : '').trim() || null,
            });
            return Object.assign(Object.assign({}, exists), { active: true });
        }
        return this.connection.getRepository(ctx, support_entities_1.CampusBlacklist).save({
            channelId: ctx.channelId,
            type,
            customerId,
            phone,
            reason: String((_d = input.reason) !== null && _d !== void 0 ? _d : '').trim() || null,
            createdBy: String((_e = ctx.activeUserId) !== null && _e !== void 0 ? _e : ''),
            active: true,
        });
    }
    async removeBlacklist(ctx, id) {
        const row = await this.connection.getRepository(ctx, support_entities_1.CampusBlacklist).findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        if (!row)
            throw new core_1.UserInputError('记录不存在或不属于当前店铺');
        await this.connection.getRepository(ctx, support_entities_1.CampusBlacklist).delete(row.id);
        return { ok: true };
    }
};
exports.SupportService = SupportService;
exports.SupportService = SupportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService,
        rider_credit_service_1.RiderCreditService])
], SupportService);
//# sourceMappingURL=support.service.js.map