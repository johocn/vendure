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
exports.FeedbackService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const faq_entry_entity_1 = require("./faq-entry.entity");
const feedback_entity_1 = require("./feedback.entity");
const types_1 = require("./types");
const FEEDBACK_STATUSES = ['pending', 'processing', 'resolved'];
/** 反馈类型白名单（与 C 端 TYPE_KEYS 对齐），非法值拒绝提交 */
const FEEDBACK_TYPES = ['bug', 'experience', 'other'];
const MAX_TITLE_LENGTH = 20;
const MAX_CONTACT_LENGTH = 30;
let FeedbackService = class FeedbackService {
    constructor(connection, listQueryBuilder, customerService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
    }
    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径）。 */
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
    /** 解析 i18n JSON 列（坏 JSON/非对象返回 null）。 */
    parseI18n(raw) {
        if (!raw) {
            return null;
        }
        try {
            const v = JSON.parse(raw);
            return v && typeof v === 'object' ? v : null;
        }
        catch (_a) {
            return null;
        }
    }
    /** shop：启用中的 FAQ（渠道隔离 + type/lang 过滤合并，sort ASC/id ASC）。lang 直传前端 locale，缺失语言回退基线 title/content。未登录可访问。 */
    async faqs(ctx, type, lang) {
        const repo = this.connection.getRepository(ctx, faq_entry_entity_1.FaqEntry);
        const qb = repo
            .createQueryBuilder('faq')
            .innerJoin('faq.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('faq.enabled = :enabled', { enabled: true })
            .orderBy('faq.sort', 'ASC')
            .addOrderBy('faq.id', 'ASC');
        if (type) {
            qb.andWhere('faq.type = :type', { type });
        }
        const list = await qb.getMany();
        if (!lang || !types_1.CONTENT_LOCALES.includes(lang)) {
            return list;
        }
        return list.map(f => {
            var _a, _b;
            const ti = this.parseI18n(f.titleI18n);
            const ci = this.parseI18n(f.contentI18n);
            return Object.assign(Object.assign({}, f), { title: (_a = ti === null || ti === void 0 ? void 0 : ti[lang]) !== null && _a !== void 0 ? _a : f.title, content: (_b = ci === null || ci === void 0 ? void 0 : ci[lang]) !== null && _b !== void 0 ? _b : f.content });
        });
    }
    /** admin：FAQ 分页列表（按当前渠道隔离）。 */
    adminFaqs(ctx, options) {
        return this.listQueryBuilder
            .build(faq_entry_entity_1.FaqEntry, { skip: options === null || options === void 0 ? void 0 : options.skip, take: options === null || options === void 0 ? void 0 : options.take }, {
            ctx,
            channelId: ctx.channelId,
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /** admin：保存 FAQ（有 id 更新、无 id 新建；渠道归属始终取当前渠道）。 */
    async saveFaq(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        const repo = this.connection.getRepository(ctx, faq_entry_entity_1.FaqEntry);
        let faq;
        if (input.id) {
            const existing = await repo.findOne({ where: { id: input.id } });
            if (!existing) {
                throw new core_1.UserInputError(`FaqEntry ${input.id} not found`);
            }
            faq = existing;
            if (input.title != null) {
                faq.title = input.title;
            }
            if (input.content != null) {
                faq.content = input.content;
            }
            if (input.type != null) {
                faq.type = input.type;
            }
            if (input.sort != null) {
                faq.sort = input.sort;
            }
            if (input.enabled != null) {
                faq.enabled = input.enabled;
            }
            if (input.titleI18n !== undefined) {
                faq.titleI18n = input.titleI18n ? JSON.stringify(input.titleI18n) : null;
            }
            if (input.contentI18n !== undefined) {
                faq.contentI18n = input.contentI18n ? JSON.stringify(input.contentI18n) : null;
            }
        }
        else {
            const title = (_b = (_a = input.title) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
            const content = (_d = (_c = input.content) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
            if (!title) {
                throw new core_1.UserInputError('title is required');
            }
            if (!content) {
                throw new core_1.UserInputError('content is required');
            }
            faq = repo.create({
                title,
                content,
                type: (_e = input.type) !== null && _e !== void 0 ? _e : 'general',
                sort: (_f = input.sort) !== null && _f !== void 0 ? _f : 0,
                enabled: (_g = input.enabled) !== null && _g !== void 0 ? _g : true,
                titleI18n: input.titleI18n ? JSON.stringify(input.titleI18n) : null,
                contentI18n: input.contentI18n ? JSON.stringify(input.contentI18n) : null,
            });
        }
        const channel = await this.connection.getEntityOrThrow(ctx, 'Channel', ctx.channelId);
        faq.channels = [channel];
        const saved = await repo.save(faq);
        core_1.Logger.info(`FaqEntry ${saved.id} saved (enabled=${saved.enabled})`, constants_1.loggerCtx);
        return saved;
    }
    async deleteFaq(ctx, id) {
        const repo = this.connection.getRepository(ctx, faq_entry_entity_1.FaqEntry);
        const faq = await repo.findOne({ where: { id } });
        if (!faq) {
            throw new core_1.UserInputError(`FaqEntry ${id} not found`);
        }
        await repo.remove(faq);
        core_1.Logger.info(`FaqEntry ${id} deleted`, constants_1.loggerCtx);
        return true;
    }
    /** shop：我的反馈列表。 */
    async myFeedbacks(ctx, options) {
        const customer = await this.requireCustomer(ctx);
        return this.listQueryBuilder
            .build(feedback_entity_1.Feedback, {
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            filter: { customerId: { eq: customer.id } },
        }, { ctx })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /** admin：全量反馈列表（status 可选过滤）。 */
    adminFeedbacks(ctx, options) {
        const filter = {};
        if (options === null || options === void 0 ? void 0 : options.status) {
            filter.status = { eq: options.status };
        }
        return this.listQueryBuilder
            .build(feedback_entity_1.Feedback, {
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            filter: Object.keys(filter).length ? filter : undefined,
        }, { ctx })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /** shop：提交意见反馈（type 白名单、title ≤20、contactWay ≤30，imgs 数组 JSON 化存储）。 */
    async createFeedback(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        const customer = await this.requireCustomer(ctx);
        const type = (_a = input.type) !== null && _a !== void 0 ? _a : 'other';
        if (!FEEDBACK_TYPES.includes(type)) {
            throw new core_1.UserInputError(`Invalid feedback type "${type}"`);
        }
        const title = (_c = (_b = input.title) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
        if (!title) {
            throw new core_1.UserInputError('title is required');
        }
        if (title.length > MAX_TITLE_LENGTH) {
            throw new core_1.UserInputError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
        }
        const content = (_e = (_d = input.content) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : '';
        if (!content) {
            throw new core_1.UserInputError('content is required');
        }
        const contactWay = (_g = (_f = input.contactWay) === null || _f === void 0 ? void 0 : _f.trim()) !== null && _g !== void 0 ? _g : null;
        if (contactWay && contactWay.length > MAX_CONTACT_LENGTH) {
            throw new core_1.UserInputError(`contactWay must be at most ${MAX_CONTACT_LENGTH} characters`);
        }
        const repo = this.connection.getRepository(ctx, feedback_entity_1.Feedback);
        const saved = await repo.save(repo.create({
            customerId: customer.id,
            type,
            title,
            content,
            imgs: Array.isArray(input.imgs) && input.imgs.length ? JSON.stringify(input.imgs) : null,
            contactWay,
            status: 'pending',
        }));
        core_1.Logger.info(`Feedback ${saved.id} created by customer ${customer.id}`, constants_1.loggerCtx);
        return saved;
    }
    /** admin：回复反馈。resolve=true 直接 resolved；否则 pending 转 processing。仅 pending/processing 可回复。 */
    async replyFeedback(ctx, id, reply, resolve) {
        var _a;
        const repo = this.connection.getRepository(ctx, feedback_entity_1.Feedback);
        const fb = await repo.findOne({ where: { id } });
        if (!fb) {
            throw new core_1.UserInputError(`Feedback ${id} not found`);
        }
        if (fb.status === 'resolved') {
            throw new core_1.UserInputError(`Feedback is resolved`);
        }
        const text = (_a = reply === null || reply === void 0 ? void 0 : reply.trim()) !== null && _a !== void 0 ? _a : '';
        if (!text) {
            throw new core_1.UserInputError('reply is required');
        }
        fb.reply = text;
        fb.repliedAt = new Date();
        fb.repliedBy = ctx.activeUserId != null ? String(ctx.activeUserId) : null;
        // 新回复重开未读（用户再次收到角标提醒）；readAt 类型与列声明同构 Date，清空经 as any
        fb.readAt = null;
        if (resolve) {
            fb.status = 'resolved';
            fb.handledAt = new Date();
        }
        else if (fb.status === 'pending') {
            fb.status = 'processing';
        }
        const saved = await repo.save(fb);
        core_1.Logger.info(`Feedback ${id} replied (status=${saved.status})`, constants_1.loggerCtx);
        return saved;
    }
    /** shop：当前用户全部可读反馈标记已读（幂等），返回最新未读数。 */
    async markFeedbacksRead(ctx) {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, feedback_entity_1.Feedback);
        await repo.update({ customerId: customer.id, readAt: (0, typeorm_1.IsNull)(), status: (0, typeorm_1.Not)('pending') }, { readAt: new Date() });
        return this.unreadFeedbackCount(ctx);
    }
    /** shop：未读数 = readAt 为空且状态非 pending。 */
    async unreadFeedbackCount(ctx) {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, feedback_entity_1.Feedback);
        return repo.count({ where: { customerId: customer.id, readAt: (0, typeorm_1.IsNull)(), status: (0, typeorm_1.Not)('pending') } });
    }
    /** admin：流转反馈状态（pending/processing/resolved），同时盖 handledAt。 */
    async updateFeedbackStatus(ctx, id, status) {
        if (!FEEDBACK_STATUSES.includes(status)) {
            throw new core_1.UserInputError(`Invalid feedback status "${status}"`);
        }
        const repo = this.connection.getRepository(ctx, feedback_entity_1.Feedback);
        const feedback = await repo.findOne({ where: { id } });
        if (!feedback) {
            throw new core_1.UserInputError(`Feedback ${id} not found`);
        }
        feedback.status = status;
        feedback.handledAt = new Date();
        const saved = await repo.save(feedback);
        core_1.Logger.info(`Feedback ${id} status -> ${status}`, constants_1.loggerCtx);
        return saved;
    }
};
exports.FeedbackService = FeedbackService;
exports.FeedbackService = FeedbackService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService])
], FeedbackService);
//# sourceMappingURL=feedback.service.js.map