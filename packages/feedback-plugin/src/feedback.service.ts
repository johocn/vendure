import { Injectable } from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import {
    Customer,
    CustomerService,
    EntityNotFoundError,
    ID,
    ListQueryBuilder,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { FaqEntry } from './faq-entry.entity';
import { Feedback } from './feedback.entity';
import { CONTENT_LOCALES, CreateFeedbackInput, FaqListOptions, FeedbackListOptions, SaveFaqInput } from './types';

const FEEDBACK_STATUSES: Array<Feedback['status']> = ['pending', 'processing', 'resolved'];

const MAX_TITLE_LENGTH = 20;
const MAX_CONTACT_LENGTH = 30;

@Injectable()
export class FeedbackService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}

    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径）。 */
    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }

    /** 解析 i18n JSON 列（坏 JSON/非对象返回 null）。 */
    private parseI18n(raw: string | null): Record<string, string> | null {
        if (!raw) {
            return null;
        }
        try {
            const v = JSON.parse(raw);
            return v && typeof v === 'object' ? v : null;
        } catch {
            return null;
        }
    }

    /** shop：启用中的 FAQ（渠道隔离 + type/lang 过滤合并，sort ASC/id ASC）。lang 直传前端 locale，缺失语言回退基线 title/content。未登录可访问。 */
    async faqs(ctx: RequestContext, type?: string, lang?: string): Promise<FaqEntry[]> {
        const repo = this.connection.getRepository(ctx, FaqEntry);
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
        if (!lang || !(CONTENT_LOCALES as readonly string[]).includes(lang)) {
            return list;
        }
        return list.map(f => {
            const ti = this.parseI18n(f.titleI18n);
            const ci = this.parseI18n(f.contentI18n);
            return {
                ...f,
                title: ti?.[lang] ?? f.title,
                content: ci?.[lang] ?? f.content,
            } as FaqEntry;
        });
    }

    /** admin：FAQ 分页列表（按当前渠道隔离）。 */
    adminFaqs(ctx: RequestContext, options?: FaqListOptions): Promise<PaginatedList<FaqEntry>> {
        return this.listQueryBuilder
            .build(FaqEntry, { skip: options?.skip, take: options?.take } as any, {
                ctx,
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /** admin：保存 FAQ（有 id 更新、无 id 新建；渠道归属始终取当前渠道）。 */
    async saveFaq(ctx: RequestContext, input: SaveFaqInput): Promise<FaqEntry> {
        const repo = this.connection.getRepository(ctx, FaqEntry);
        let faq: FaqEntry;
        if (input.id) {
            const existing = await repo.findOne({ where: { id: input.id } as any });
            if (!existing) {
                throw new UserInputError(`FaqEntry ${input.id} not found`);
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
        } else {
            const title = input.title?.trim() ?? '';
            const content = input.content?.trim() ?? '';
            if (!title) {
                throw new UserInputError('title is required');
            }
            if (!content) {
                throw new UserInputError('content is required');
            }
            faq = repo.create({
                title,
                content,
                type: input.type ?? 'general',
                sort: input.sort ?? 0,
                enabled: input.enabled ?? true,
                titleI18n: input.titleI18n ? JSON.stringify(input.titleI18n) : null,
                contentI18n: input.contentI18n ? JSON.stringify(input.contentI18n) : null,
            }) as FaqEntry;
        }
        const channel = await this.connection.getEntityOrThrow(ctx, 'Channel' as any, ctx.channelId);
        faq.channels = [channel as any];
        const saved = await repo.save(faq);
        Logger.info(`FaqEntry ${saved.id} saved (enabled=${saved.enabled})`, loggerCtx);
        return saved;
    }

    async deleteFaq(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, FaqEntry);
        const faq = await repo.findOne({ where: { id } as any });
        if (!faq) {
            throw new UserInputError(`FaqEntry ${id} not found`);
        }
        await repo.remove(faq);
        Logger.info(`FaqEntry ${id} deleted`, loggerCtx);
        return true;
    }

    /** shop：我的反馈列表。 */
    async myFeedbacks(ctx: RequestContext, options?: FeedbackListOptions): Promise<PaginatedList<Feedback>> {
        const customer = await this.requireCustomer(ctx);
        return this.listQueryBuilder
            .build(
                Feedback,
                {
                    skip: options?.skip,
                    take: options?.take,
                    filter: { customerId: { eq: customer.id } },
                } as any,
                { ctx },
            )
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /** admin：全量反馈列表（status 可选过滤）。 */
    adminFeedbacks(ctx: RequestContext, options?: FeedbackListOptions): Promise<PaginatedList<Feedback>> {
        const filter: any = {};
        if (options?.status) {
            filter.status = { eq: options.status };
        }
        return this.listQueryBuilder
            .build(
                Feedback,
                {
                    skip: options?.skip,
                    take: options?.take,
                    filter: Object.keys(filter).length ? filter : undefined,
                } as any,
                { ctx },
            )
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /** shop：提交意见反馈（title ≤20、contactWay ≤30，imgs 数组 JSON 化存储）。 */
    async createFeedback(ctx: RequestContext, input: CreateFeedbackInput): Promise<Feedback> {
        const customer = await this.requireCustomer(ctx);
        const title = input.title?.trim() ?? '';
        if (!title) {
            throw new UserInputError('title is required');
        }
        if (title.length > MAX_TITLE_LENGTH) {
            throw new UserInputError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
        }
        const content = input.content?.trim() ?? '';
        if (!content) {
            throw new UserInputError('content is required');
        }
        const contactWay = input.contactWay?.trim() ?? null;
        if (contactWay && contactWay.length > MAX_CONTACT_LENGTH) {
            throw new UserInputError(`contactWay must be at most ${MAX_CONTACT_LENGTH} characters`);
        }
        const repo = this.connection.getRepository(ctx, Feedback);
        const saved = await repo.save(
            repo.create({
                customerId: customer.id as number,
                type: input.type ?? 'other',
                title,
                content,
                imgs: Array.isArray(input.imgs) && input.imgs.length ? JSON.stringify(input.imgs) : null,
                contactWay,
                status: 'pending',
            }),
        );
        Logger.info(`Feedback ${saved.id} created by customer ${customer.id}`, loggerCtx);
        return saved;
    }

    /** admin：回复反馈。resolve=true 直接 resolved；否则 pending 转 processing。仅 pending/processing 可回复。 */
    async replyFeedback(ctx: RequestContext, id: string, reply: string, resolve: boolean): Promise<Feedback> {
        const repo = this.connection.getRepository(ctx, Feedback);
        const fb = await repo.findOne({ where: { id } as any });
        if (!fb) {
            throw new UserInputError(`Feedback ${id} not found`);
        }
        if (fb.status === 'resolved') {
            throw new UserInputError(`Feedback is resolved`);
        }
        const text = reply?.trim() ?? '';
        if (!text) {
            throw new UserInputError('reply is required');
        }
        fb.reply = text;
        fb.repliedAt = new Date();
        fb.repliedBy = ctx.activeUserId != null ? String(ctx.activeUserId) : null;
        // 新回复重开未读（用户再次收到角标提醒）；readAt 类型与列声明同构 Date，清空经 as any
        (fb as any).readAt = null;
        if (resolve) {
            fb.status = 'resolved';
            fb.handledAt = new Date();
        } else if (fb.status === 'pending') {
            fb.status = 'processing';
        }
        const saved = await repo.save(fb);
        Logger.info(`Feedback ${id} replied (status=${saved.status})`, loggerCtx);
        return saved;
    }

    /** shop：当前用户全部可读反馈标记已读（幂等），返回最新未读数。 */
    async markFeedbacksRead(ctx: RequestContext): Promise<number> {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, Feedback);
        await repo.update(
            { customerId: customer.id, readAt: IsNull(), status: Not('pending') } as any,
            { readAt: new Date() } as any,
        );
        return this.unreadFeedbackCount(ctx);
    }

    /** shop：未读数 = readAt 为空且状态非 pending。 */
    async unreadFeedbackCount(ctx: RequestContext): Promise<number> {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, Feedback);
        return repo.count({ where: { customerId: customer.id, readAt: IsNull(), status: Not('pending') } as any });
    }

    /** admin：流转反馈状态（pending/processing/resolved），同时盖 handledAt。 */
    async updateFeedbackStatus(ctx: RequestContext, id: ID, status: string): Promise<Feedback> {
        if (!FEEDBACK_STATUSES.includes(status as Feedback['status'])) {
            throw new UserInputError(`Invalid feedback status "${status}"`);
        }
        const repo = this.connection.getRepository(ctx, Feedback);
        const feedback = await repo.findOne({ where: { id } as any });
        if (!feedback) {
            throw new UserInputError(`Feedback ${id} not found`);
        }
        feedback.status = status as Feedback['status'];
        feedback.handledAt = new Date();
        const saved = await repo.save(feedback);
        Logger.info(`Feedback ${id} status -> ${status}`, loggerCtx);
        return saved;
    }
}
