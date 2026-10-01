import { RequestContext } from '@vendure/core';
import { InStoreBillService } from './in-store-bill.service';
/**
 * 到店买单（admin-api）：商户端核销 + 流水查询。
 * 权限沿用 coupon-plugin 范式：@Allow(Permission.UpdateOrder)，
 * 属店隔离由 service 内的 assertManagedByShop（券模板）+ ctx.channelId（流水）共同保证。
 */
export declare class InStoreBillAdminResolver {
    private inStoreBillService;
    constructor(inStoreBillService: InStoreBillService);
    inStoreBillQuote(ctx: RequestContext, code: string, originalAmount?: number): Promise<import("./in-store-bill.service").InStoreBillQuote>;
    inStoreBills(ctx: RequestContext, options?: any): Promise<{
        items: import("./in-store-bill.entity").InStoreBill[];
        totalItems: number;
    }>;
    inStoreBillSummary(ctx: RequestContext, options?: any): Promise<{
        count: number;
        originalTotal: number;
        discountTotal: number;
        finalTotal: number;
    }>;
    inStoreBillRedeem(ctx: RequestContext, code: string, originalAmount: number, remark?: string): Promise<import("./in-store-bill.entity").InStoreBill>;
}
