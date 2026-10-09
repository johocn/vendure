import { ID, PaginatedList, RequestContext } from '@vendure/core';
import { FaqEntry } from './faq-entry.entity';
import { Feedback } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackInput, FaqListOptions, FeedbackListOptions, SaveFaqInput } from './types';
export declare class FeedbackShopResolver {
    private feedbackService;
    constructor(feedbackService: FeedbackService);
    /** 未登录可看 FAQ（对齐 usemall），不加 @Allow。 */
    faqs(ctx: RequestContext, type?: string): Promise<FaqEntry[]>;
    myFeedbacks(ctx: RequestContext, options?: FeedbackListOptions): Promise<PaginatedList<Feedback>>;
    createFeedback(ctx: RequestContext, input: CreateFeedbackInput): Promise<Feedback>;
}
export declare class FeedbackAdminResolver {
    private feedbackService;
    constructor(feedbackService: FeedbackService);
    faqEntries(ctx: RequestContext, options?: FaqListOptions): Promise<PaginatedList<FaqEntry>>;
    feedbacks(ctx: RequestContext, options?: FeedbackListOptions): Promise<PaginatedList<Feedback>>;
    saveFaq(ctx: RequestContext, input: SaveFaqInput): Promise<FaqEntry>;
    deleteFaq(ctx: RequestContext, id: ID): Promise<boolean>;
    updateFeedbackStatus(ctx: RequestContext, id: ID, status: string): Promise<Feedback>;
}
