import { ID, RequestContext } from '@vendure/core';
import { ReviewAlert } from './review-alert.entity';
import { ReviewAlertService } from './review-alert.service';
/** P4-2 评价品质闭环：预警规则读写 + 预警列表/详情/回评/补券/关闭。 */
export declare class ReviewAlertResolver {
    private alertService;
    constructor(alertService: ReviewAlertService);
    reviewAlertRule(ctx: RequestContext): Promise<any>;
    reviewAlerts(ctx: RequestContext, options: any): Promise<any>;
    reviewAlert(ctx: RequestContext, id: ID): Promise<any>;
    reviewAlertStats(ctx: RequestContext): Promise<any>;
    updateReviewAlertRule(ctx: RequestContext, input: any): Promise<any>;
    replyReviewAlert(ctx: RequestContext, id: ID, reply: string): Promise<any>;
    resendReviewAlertCoupon(ctx: RequestContext, id: ID): Promise<any>;
    closeReviewAlert(ctx: RequestContext, id: ID, note?: string): Promise<any>;
    productName(ctx: RequestContext, alert: ReviewAlert): Promise<string | null>;
}
