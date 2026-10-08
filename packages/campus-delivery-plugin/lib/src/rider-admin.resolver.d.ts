import { ID, RequestContext } from '@vendure/core';
import { RiderService } from './rider.service';
import { RiderWalletService } from './rider-wallet.service';
export declare class RiderAdminResolver {
    private riderService;
    private wallet;
    constructor(riderService: RiderService, wallet: RiderWalletService);
    /** 骑手入驻申请列表（F8 分页：返回 { items, total }） */
    riderApplications(ctx: RequestContext, status: string, skip?: number, take?: number): Promise<{
        items: import("@vendure/core").Customer[];
        total: number;
    }>;
    campusSetRiderStatus(ctx: RequestContext, customerId: ID, status: 'approved' | 'suspended' | 'none'): Promise<{
        status: "approved" | "suspended" | "none";
    }>;
    /** 骑手提现申请列表（status=ALL/PENDING/PAID/REJECTED，渠道隔离） */
    riderWithdrawals(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<import("./rider-withdrawal.entity").RiderWithdrawalRequest[]>;
    /** 通过：标记 PAID 留痕（金额已在申请时冻结扣减） */
    approveRiderWithdraw(ctx: RequestContext, id: ID, remark?: string): Promise<import("./rider-withdrawal.entity").RiderWithdrawalRequest | null>;
    /** 驳回：状态 REJECTED 并退回冻结金额 */
    rejectRiderWithdraw(ctx: RequestContext, id: ID, remark?: string): Promise<import("./rider-withdrawal.entity").RiderWithdrawalRequest | null>;
}
