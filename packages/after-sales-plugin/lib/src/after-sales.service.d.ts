import { ID, Injector, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { AfterSalesRequest } from './after-sales-request.entity';
export declare class AfterSalesService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private options;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    init(injector: Injector): void;
    findOne(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined>;
    /**
     * Shop API 专用：按 customerId 过滤，防止越权枚举他人售后单。
     */
    findOneForCustomer(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined>;
    findMyRequests(ctx: RequestContext, options?: ListQueryOptions<AfterSalesRequest>): Promise<PaginatedList<AfterSalesRequest>>;
    findAll(ctx: RequestContext, options?: ListQueryOptions<AfterSalesRequest>): Promise<PaginatedList<AfterSalesRequest>>;
    createRequest(ctx: RequestContext, input: {
        orderId: ID;
        orderLineId?: ID;
        type: string;
        reason: string;
        description?: string;
        evidenceImages?: string[];
        refundAmount: number;
    }): Promise<AfterSalesRequest>;
    cancelRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    updateReturnTracking(ctx: RequestContext, id: ID, trackingNo: string, carrier: string): Promise<AfterSalesRequest>;
    approveRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    rejectRequest(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest>;
    confirmReceive(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    /**
     * 回写 Order customFields.afterSalesStatus。失败仅告警，不影响主流程。
     */
    private updateOrderAfterSalesStatus;
    private transitionState;
}
