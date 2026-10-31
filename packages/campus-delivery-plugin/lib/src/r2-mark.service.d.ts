import { ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
/**
 * R2 快递单：外部快递抵达校园交接点（第一程完成）。
 * 权威事实源是外部运单回调（thirdPartyState=delivered 时由回调写入 arrived_gate）；
 * 本接口仅供「快递员已取件但回调滞后/丢失」的兜底确认，因此要求 thirdPartyState 至少为 pickup。
 * 第二段由入厅后校园骑手接力，学生无需再发 R5 跑腿代取（errandFrom 指向 R2 单会被拒绝）。
 * 归属校验：customer.user.id 与 ctx.activeUserId 同为 User 表主键，直接可比。
 */
export declare class R2MarkService {
    private connection;
    private orderService;
    constructor(connection: TransactionalConnection, orderService: OrderService);
    /** R2: 学生确认快递已到校 → leg1Status='arrived_gate' + handoverAt */
    markArrived(ctx: RequestContext, orderId: ID): Promise<{
        leg1Status: string;
    }>;
    /** R2 原单动态反查接力单：errandFrom=本单 code 的 R5 单，实时读状态、不写回标记（二期 §3.5/§4.3） */
    relayStatus(ctx: RequestContext, orderId: ID): Promise<{
        orderId: ID;
        orderCode: string;
        state: import("@vendure/core").OrderState;
        hallStatus: any;
        deliveryStatus: any;
        errandTo: any;
        tip: any;
        totalWithTax: number;
    } | null>;
}
