import { CustomerService, ID, ListQueryBuilder, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { FaqEntry } from './faq-entry.entity';
import { Feedback } from './feedback.entity';
import { CreateFeedbackInput, FaqListOptions, FeedbackListOptions, SaveFaqInput } from './types';
export declare class FeedbackService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径）。 */
    private requireCustomer;
    /** shop：启用中的 FAQ（渠道隔离 + type 可选过滤，sort ASC/id ASC）。未登录可访问。 */
    faqs(ctx: RequestContext, type?: string): Promise<FaqEntry[]>;
    /** admin：FAQ 分页列表（按当前渠道隔离）。 */
    adminFaqs(ctx: RequestContext, options?: FaqListOptions): Promise<PaginatedList<FaqEntry>>;
    /** admin：保存 FAQ（有 id 更新、无 id 新建；渠道归属始终取当前渠道）。 */
    saveFaq(ctx: RequestContext, input: SaveFaqInput): Promise<FaqEntry>;
    deleteFaq(ctx: RequestContext, id: ID): Promise<boolean>;
    /** shop：我的反馈列表。 */
    myFeedbacks(ctx: RequestContext, options?: FeedbackListOptions): Promise<PaginatedList<Feedback>>;
    /** admin：全量反馈列表（status 可选过滤）。 */
    adminFeedbacks(ctx: RequestContext, options?: FeedbackListOptions): Promise<PaginatedList<Feedback>>;
    /** shop：提交意见反馈（title ≤20、contactWay ≤30，imgs 数组 JSON 化存储）。 */
    createFeedback(ctx: RequestContext, input: CreateFeedbackInput): Promise<Feedback>;
    /** admin：流转反馈状态（pending/processing/resolved），同时盖 handledAt。 */
    updateFeedbackStatus(ctx: RequestContext, id: ID, status: string): Promise<Feedback>;
}
