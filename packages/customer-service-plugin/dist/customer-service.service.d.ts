import { ID } from '@vendure/common/lib/shared-types';
import { Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { AfterSalesService, AfterSalesRequest } from '@vendure/after-sales-plugin';
/**
 * @description
 * 客服核心服务：全量订单查询、售后处理（代理 AfterSalesService）、异常订单跟进。
 *
 * 设计说明：
 * - findAllOrders 不过滤 staffId（客服可查全部订单），不过滤 active（含 Cancelled/Completed）
 * - 售后方法代理 AfterSalesService 的短名方法（approveRequest/rejectRequest/confirmReceive/processRefund）
 * - csNotes 为追加模式，不修改原有备注
 */
export declare class CustomerServiceService {
    private connection;
    private orderService;
    private afterSalesService;
    constructor(connection: TransactionalConnection, orderService: OrderService, afterSalesService: AfterSalesService);
    /**
     * 全量订单查询（无 staffId 过滤，支持 state/email/日期筛选 + 分页）
     */
    findAllOrders(ctx: RequestContext, options?: {
        state?: string;
        customerEmail?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: Order[];
        totalItems: number;
    }>;
    /**
     * 订单详情（聚合 order + 关联售后单 + 异常信息）
     */
    findOrderDetail(ctx: RequestContext, orderId: ID): Promise<{
        order: Order;
        afterSalesRequests: AfterSalesRequest[];
        exceptionInfo: {
            deliveryStatus: string;
            exceptionType?: string | null;
            exceptionNote?: string | null;
            exceptionPhotos?: string[] | null;
            deliveryStaffId?: string | null;
        } | null;
    } | null>;
    approveAfterSales(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    rejectAfterSales(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest>;
    confirmReturnReceived(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    /**
     * 售后单列表查询（直接查 AfterSalesRequest 实体，支持 state 筛选 + 分页）
     */
    findAfterSalesRequests(ctx: RequestContext, options?: {
        state?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: AfterSalesRequest[];
        totalItems: number;
    }>;
    findOneAfterSalesRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined>;
    /**
     * 查询异常订单（customFields.deliveryStatus = 'exception'）
     */
    findExceptionOrders(ctx: RequestContext, options?: {
        exceptionType?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: Array<{
            order: Order;
            exceptionInfo: {
                deliveryStatus: string;
                exceptionType?: string | null;
                exceptionNote?: string | null;
                exceptionPhotos?: string[] | null;
                deliveryStaffId?: string | null;
            };
            csNotes: any[];
        }>;
        totalItems: number;
    }>;
    /**
     * 追加客服备注（不修改原有备注）
     */
    addExceptionNote(ctx: RequestContext, orderId: ID, note: string): Promise<Order>;
}
