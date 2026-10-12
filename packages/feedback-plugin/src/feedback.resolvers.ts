import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';

import { FaqEntry } from './faq-entry.entity';
import { Feedback } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackInput, FaqListOptions, FeedbackListOptions, SaveFaqInput } from './types';

@Resolver()
export class FeedbackShopResolver {
    constructor(private feedbackService: FeedbackService) {}

    /** 未登录可看 FAQ（对齐 usemall），不加 @Allow。lang 直传前端 locale（CONTENT_LOCALES 白名单外回退基线）。 */
    @Query()
    async faqs(
        @Ctx() ctx: RequestContext,
        @Args('type', { nullable: true }) type?: string,
        @Args('lang', { nullable: true }) lang?: string,
    ): Promise<FaqEntry[]> {
        return this.feedbackService.faqs(ctx, type, lang);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myFeedbacks(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: FeedbackListOptions,
    ): Promise<PaginatedList<Feedback>> {
        return this.feedbackService.myFeedbacks(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async createFeedback(
        @Ctx() ctx: RequestContext,
        @Args('input') input: CreateFeedbackInput,
    ): Promise<Feedback> {
        return this.feedbackService.createFeedback(ctx, input);
    }

    /** 全部可读反馈标记已读（幂等），返回最新未读数。 */
    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async markFeedbacksRead(@Ctx() ctx: RequestContext): Promise<number> {
        return this.feedbackService.markFeedbacksRead(ctx);
    }

    /** 未读数 = readAt 为空且状态非 pending。 */
    @Query()
    @Allow(Permission.Authenticated)
    async unreadFeedbackCount(@Ctx() ctx: RequestContext): Promise<number> {
        return this.feedbackService.unreadFeedbackCount(ctx);
    }
}

@Resolver()
export class FeedbackAdminResolver {
    constructor(private feedbackService: FeedbackService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async faqEntries(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: FaqListOptions,
    ): Promise<PaginatedList<FaqEntry>> {
        return this.feedbackService.adminFaqs(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadSettings)
    async feedbacks(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: FeedbackListOptions,
    ): Promise<PaginatedList<Feedback>> {
        return this.feedbackService.adminFeedbacks(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async saveFaq(@Ctx() ctx: RequestContext, @Args('input') input: SaveFaqInput): Promise<FaqEntry> {
        return this.feedbackService.saveFaq(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async deleteFaq(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.feedbackService.deleteFaq(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async updateFeedbackStatus(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('status') status: string,
    ): Promise<Feedback> {
        return this.feedbackService.updateFeedbackStatus(ctx, id, status);
    }

    /** 回复反馈：resolve=true 直接 resolved；否则 pending 转 processing。仅 pending/processing 可回复。 */
    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async replyFeedback(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reply') reply: string,
        @Args('resolve', { nullable: true, defaultValue: false }) resolve?: boolean,
    ): Promise<Feedback> {
        return this.feedbackService.replyFeedback(ctx, String(id), reply, resolve ?? false);
    }
}
