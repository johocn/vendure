import { ID, RequestContext } from '@vendure/core';
import { CustomerServiceService } from './customer-service.service';
/**
 * @description
 * 客服 Admin API Resolver（schema-first 模式）。
 *
 * 权限映射：
 * - csAllOrders / csOrderDetail → ViewAllOrders
 * - csAfterSalesRequests / csAfterSalesRequestDetail / csApproveAfterSales / csRejectAfterSales / csConfirmReturnReceived / csProcessRefund → HandleAfterSales
 * - csExceptionOrders / csAddExceptionNote → HandleException
 *
 * 注意：权限名 ViewAllOrders/HandleAfterSales/HandleException 由 delivery-plugin 注册到 customPermissions，
 * 此处用 `'xxx' as Permission` 字符串字面量引用，不重复注册 PermissionDefinition。
 */
export declare class CustomerServiceAdminResolver {
    private csService;
    constructor(csService: CustomerServiceService);
    csAllOrders(ctx: RequestContext, state?: string, customerEmail?: string, startDate?: string, endDate?: string, page?: number, pageSize?: number): Promise<{
        items: import("@vendure/core").Order[];
        totalItems: number;
    }>;
    csOrderDetail(ctx: RequestContext, id: ID): Promise<{
        order: import("@vendure/core").Order;
        afterSalesRequests: import("@vendure/after-sales-plugin").AfterSalesRequest[];
        exceptionInfo: {
            deliveryStatus: string;
            exceptionType?: string | null;
            exceptionNote?: string | null;
            exceptionPhotos?: string[] | null;
            deliveryStaffId?: string | null;
        } | null;
    } | null>;
    csAfterSalesRequests(ctx: RequestContext, state?: string, page?: number, pageSize?: number): Promise<{
        items: import("@vendure/after-sales-plugin").AfterSalesRequest[];
        totalItems: number;
    }>;
    csAfterSalesRequestDetail(ctx: RequestContext, id: ID): Promise<import("@vendure/after-sales-plugin").AfterSalesRequest | undefined>;
    csApproveAfterSales(ctx: RequestContext, id: ID): Promise<import("@vendure/after-sales-plugin").AfterSalesRequest>;
    csRejectAfterSales(ctx: RequestContext, id: ID, reason: string): Promise<import("@vendure/after-sales-plugin").AfterSalesRequest>;
    csConfirmReturnReceived(ctx: RequestContext, id: ID): Promise<import("@vendure/after-sales-plugin").AfterSalesRequest>;
    csProcessRefund(ctx: RequestContext, id: ID): Promise<import("@vendure/after-sales-plugin").AfterSalesRequest>;
    csExceptionOrders(ctx: RequestContext, exceptionType?: string, page?: number, pageSize?: number): Promise<{
        items: Array<{
            order: import("@vendure/core").Order;
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
    csAddExceptionNote(ctx: RequestContext, orderId: ID, note: string): Promise<{
        order: import("@vendure/core").Order;
        exceptionInfo: {
            deliveryStatus: any;
            exceptionType: any;
            exceptionNote: any;
            exceptionPhotos: any;
            deliveryStaffId: any;
        };
        csNotes: any;
    }>;
}
