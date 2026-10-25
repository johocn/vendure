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
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
const loggerCtx = 'CampusSupport';
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
    constructor(connection, customerService, credit, feishu) {
        this.connection = connection;
        this.customerService = customerService;
        this.credit = credit;
        this.feishu = feishu;
    }
    async requireCustomer(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.ForbiddenError();
        return customer;
    }
    /** 飞书提醒：仅记录日志、绝不阻塞主流程（未启用时 pushEvent 直接返回 true） */
    async pushFeishu(scene, title, content, orderCode, dedupeKey, target) {
        var _a;
        try {
            await this.feishu.pushEvent(scene, title, content, orderCode !== null && orderCode !== void 0 ? orderCode : undefined, dedupeKey, target);
        }
        catch (e) {
            core_1.Logger.warn(`飞书提醒失败 scene=${scene}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx);
        }
    }
    /**
     * 站内信：复用 message-plugin 的 Message/MessageDelivery（invoice-plugin / coupon-plugin 已落地范式）；
     * 未装 message-plugin 时实体不存在，静默跳过，绝不阻塞工单/申诉主流程。
     */
    async sendInAppMessage(ctx, customerId, title, body) {
        var _a;
        try {
            const msgRepo = this.connection.getRepository(ctx, 'Message');
            const deliveryRepo = this.connection.getRepository(ctx, 'MessageDelivery');
            const message = await msgRepo.save(msgRepo.create({
                title,
                body,
                deliveryChannel: 'inapp',
                audienceType: 'all',
                status: 'sent',
                totalTarget: 1,
                totalSent: 1,
                channels: [ctx.channel],
            }));
            await deliveryRepo.save(deliveryRepo.create({
                messageId: message.id,
                customerId: Number(customerId),
                deliveryStatus: 'sent',
                channels: [ctx.channel],
            }));
        }
        catch (e) {
            core_1.Logger.warn(`站内信发送失败 customer=${customerId}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx);
        }
    }
    // ---------------- 客服工单 ----------------
    async createTicket(ctx, input) {
        var _a, _b, _c;
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
        // 运营提醒：新工单推当前店铺群（channel 定向；平台群始终接收），无群也不影响提交
        const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || '-';
        void this.pushFeishu('support_ticket', '新客服工单', [
            `类型：${category}`,
            orderCode ? `订单：${orderCode}` : '',
            `顾客：${name}${customer.phoneNumber ? `（${customer.phoneNumber}）` : ''}`,
            `内容：${content.slice(0, 120)}${content.length > 120 ? '…' : ''}`,
        ].filter(Boolean).join('\n'), orderCode, `ticket:${ticket.id}`, { channel: (_c = ctx.channel) === null || _c === void 0 ? void 0 : _c.code });
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
        // 站内信：回复/关闭都通知顾客（C 端消息中心红点）
        const title = target === 'closed' ? '客服工单已关闭' : '客服工单已回复';
        const body = target === 'closed'
            ? `工单 #${ticket.id} 已关闭${text ? `：${text}` : ''}`
            : `工单 #${ticket.id} 回复：${text}`;
        await this.sendInAppMessage(ctx, ticket.customerId, title, body);
        return Object.assign(Object.assign({}, ticket), { status: target, reply: text || ticket.reply });
    }
    // ---------------- 骑手申诉 ----------------
    async createAppeal(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
        const appeal = await this.connection.getRepository(ctx, support_entities_1.CampusRiderAppeal).save({
            channelId: ctx.channelId,
            riderCustomerId: customer.id,
            orderId,
            orderCode,
            reason,
            images: normalizeImages(input.images),
            status: 'pending',
            creditDelta: 0,
        });
        // 运营提醒：新申诉推当前店铺群 + 平台群，后台「运营中心」待办
        const riderName = (_h = (_g = (_f = customer.customFields) === null || _f === void 0 ? void 0 : _f.riderRealName) !== null && _g !== void 0 ? _g : customer.firstName) !== null && _h !== void 0 ? _h : '-';
        void this.pushFeishu('rider_appeal', '新骑手申诉', [
            `骑手：${riderName}${customer.phoneNumber ? `（${customer.phoneNumber}）` : ''}`,
            orderCode ? `订单：${orderCode}` : '订单：未关联',
            `理由：${reason.slice(0, 120)}${reason.length > 120 ? '…' : ''}`,
        ].join('\n'), orderCode, `appeal:${appeal.id}`, { channel: (_j = ctx.channel) === null || _j === void 0 ? void 0 : _j.code });
        return appeal;
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
        // 站内信：审核结果通知骑手（C 端消息中心红点）
        const noteText = String(note !== null && note !== void 0 ? note : '').trim();
        await this.sendInAppMessage(ctx, appeal.riderCustomerId, approve ? '骑手申诉已通过' : '骑手申诉未通过', approve
            ? `申诉已通过${appeal.orderCode ? `（订单 ${appeal.orderCode}）` : ''}，信用分 +${delta}${noteText ? `；说明：${noteText}` : ''}`
            : `申诉未通过${appeal.orderCode ? `（订单 ${appeal.orderCode}）` : ''}，信用分不变${noteText ? `；说明：${noteText}` : ''}`);
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
    /**
     * 批量导入黑名单（P3-2）：type=phone 时 values 为手机号列表；type=user 时为用户 ID 列表。
     * 去重后逐条入库；已存在且生效的计入 skipped，格式非法/不属于本店铺的计入 invalid。
     * 单次上限 500 条，避免一次性长事务。
     */
    async importBlacklist(ctx, type, values, reason) {
        var _a, _b;
        const t = String(type !== null && type !== void 0 ? type : '');
        if (!['user', 'phone'].includes(t))
            throw new core_1.UserInputError('黑名单类型不合法');
        const raw = (values !== null && values !== void 0 ? values : []).map(v => String(v !== null && v !== void 0 ? v : '').trim()).filter(Boolean);
        if (!raw.length)
            throw new core_1.UserInputError('请粘贴要导入的用户 ID 或手机号');
        if (raw.length > 500)
            throw new core_1.UserInputError('单次最多导入 500 条');
        const lines = Array.from(new Set(raw));
        const reasonText = String(reason !== null && reason !== void 0 ? reason : '').trim() || '批量导入';
        const repo = this.connection.getRepository(ctx, support_entities_1.CampusBlacklist);
        let added = 0;
        let skipped = 0;
        let invalid = 0;
        if (t === 'user') {
            const ids = lines.map(v => Number(v)).filter(n => Number.isInteger(n) && n > 0);
            invalid += lines.length - ids.length;
            const valid = new Set();
            if (ids.length) {
                const rows = await this.connection.getRepository(ctx, core_1.Customer).createQueryBuilder('customer')
                    .leftJoin('customer.channels', 'channel')
                    .where('customer.id IN (:...ids)', { ids })
                    .andWhere('channel.id = :ch', { ch: ctx.channelId })
                    .getMany();
                rows.forEach(r => valid.add(Number(r.id)));
            }
            invalid += ids.filter(id => !valid.has(id)).length;
            for (const customerId of valid) {
                const exists = await repo.findOne({
                    where: { channelId: ctx.channelId, type: 'user', customerId: customerId },
                });
                if (exists === null || exists === void 0 ? void 0 : exists.active) {
                    skipped += 1;
                    continue;
                }
                if (exists) {
                    await repo.update(exists.id, { active: true, reason: reasonText });
                }
                else {
                    await repo.save({
                        channelId: ctx.channelId,
                        type: 'user',
                        customerId,
                        phone: null,
                        reason: reasonText,
                        createdBy: String((_a = ctx.activeUserId) !== null && _a !== void 0 ? _a : ''),
                        active: true,
                    });
                }
                added += 1;
            }
            return { added, skipped, invalid };
        }
        const phones = lines
            .map(v => v.replace(/[^\d+]/g, ''))
            .filter(p => p.length >= 6 && p.length <= 20);
        invalid += lines.length - phones.length;
        for (const phone of Array.from(new Set(phones))) {
            const exists = await repo.findOne({
                where: { channelId: ctx.channelId, type: 'phone', phone: phone },
            });
            if (exists === null || exists === void 0 ? void 0 : exists.active) {
                skipped += 1;
                continue;
            }
            if (exists) {
                await repo.update(exists.id, { active: true, reason: reasonText });
            }
            else {
                await repo.save({
                    channelId: ctx.channelId,
                    type: 'phone',
                    customerId: null,
                    phone,
                    reason: reasonText,
                    createdBy: String((_b = ctx.activeUserId) !== null && _b !== void 0 ? _b : ''),
                    active: true,
                });
            }
            added += 1;
        }
        // phones 去重后与 lines 数量差异（重复行）不计 invalid，直接视为跳过
        skipped += Math.max(0, lines.length - invalid - phones.length - added - skipped);
        return { added, skipped, invalid };
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
        rider_credit_service_1.RiderCreditService,
        feishu_notify_service_1.FeishuNotifyService])
], SupportService);
//# sourceMappingURL=support.service.js.map