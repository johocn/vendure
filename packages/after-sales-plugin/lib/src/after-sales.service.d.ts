import { ID, Injector, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { AfterSalesRequest } from './after-sales-request.entity';
export declare class AfterSalesService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private inventoryService;
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
    /**
     * Mutation 保存后重新加载并返回带关系（order/orderLine）的实体。
     * 直接 repo.save() 返回的实体关系未加载，Shop SDL 中 `order: Order!` 非空字段会被自动关系解析取到 null，
     * 触发 "Cannot return null for non-nullable field AfterSalesRequest.order"。
     */
    private hydrate;
    approveRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    rejectRequest(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest>;
    /**
     * Returning → Received（收到退货）：
     * 在状态流转前先做库存回补——把收到的退货回补到原发货仓（orderLine.stockLocationId），
     * 同一事务内写 afterSales 账本，避免“退款了但库存不回来”。回补失败不影响收退货流程（告警）。
     * @param receivedQuantity 实收数量（部分退货按实收回补；缺省按订单行数量全额回补）
     */
    confirmReceive(ctx: RequestContext, id: ID, receivedQuantity?: number): Promise<AfterSalesRequest>;
    processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    /**
     * 回写 Order customFields.afterSalesStatus。失败仅告警，不影响主流程。
     */
    private updateOrderAfterSalesStatus;
    private transitionState;
}
