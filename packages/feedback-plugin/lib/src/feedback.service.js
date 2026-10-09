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
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const faq_entry_entity_1 = require("./faq-entry.entity");
const feedback_entity_1 = require("./feedback.entity");
const FEEDBACK_STATUSES = ['pending', 'processing', 'resolved'];
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
    /** shop：启用中的 FAQ（渠道隔离 + type 可选过滤，sort ASC/id ASC）。未登录可访问。 */
    async faqs(ctx, type) {
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
        return qb.getMany();
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
    /** shop：提交意见反馈（title ≤20、contactWay ≤30，imgs 数组 JSON 化存储）。 */
    async createFeedback(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        const customer = await this.requireCustomer(ctx);
        const title = (_b = (_a = input.title) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
        if (!title) {
            throw new core_1.UserInputError('title is required');
        }
        if (title.length > MAX_TITLE_LENGTH) {
            throw new core_1.UserInputError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
        }
        const content = (_d = (_c = input.content) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
        if (!content) {
            throw new core_1.UserInputError('content is required');
        }
        const contactWay = (_f = (_e = input.contactWay) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : null;
        if (contactWay && contactWay.length > MAX_CONTACT_LENGTH) {
            throw new core_1.UserInputError(`contactWay must be at most ${MAX_CONTACT_LENGTH} characters`);
        }
        const repo = this.connection.getRepository(ctx, feedback_entity_1.Feedback);
        const saved = await repo.save(repo.create({
            customerId: customer.id,
            type: (_g = input.type) !== null && _g !== void 0 ? _g : 'other',
            title,
            content,
            imgs: Array.isArray(input.imgs) && input.imgs.length ? JSON.stringify(input.imgs) : null,
            contactWay,
            status: 'pending',
        }));
        core_1.Logger.info(`Feedback ${saved.id} created by customer ${customer.id}`, constants_1.loggerCtx);
        return saved;
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