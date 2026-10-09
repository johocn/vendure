import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';

import { FaqEntry } from './faq-entry.entity';
import { Feedback } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackInput, FaqListOptions, FeedbackListOptions, SaveFaqInput } from './types';

@Resolver()
export class FeedbackShopResolver {
    constructor(private feedbackService: FeedbackService) {}

    /** 未登录可看 FAQ（对齐 usemall），不加 @Allow。 */
    @Query()
    async faqs(@Ctx() ctx: RequestContext, @Args('type', { nullable: true }) type?: string): Promise<FaqEntry[]> {
        return this.feedbackService.faqs(ctx, type);
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
}
