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
        status: "approved" | "none" | "suspended";
    }>;
    /** 骑手提现申请列表（status=ALL/PENDING/PAID/REJECTED）。
     * 钱包为平台级（余额跨渠道汇总），列表按设计不限定店铺渠道；审核权限 CampusAuditRider。 */
    riderWithdrawals(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<import("./rider-withdrawal.entity").RiderWithdrawalRequest[]>;
    /** 通过：标记 PAID + 登记打款流水号/凭证（金额已在申请时冻结扣减） */
    approveRiderWithdraw(ctx: RequestContext, id: ID, remark?: string, payoutRef?: string, payoutProof?: string): Promise<import("./rider-withdrawal.entity").RiderWithdrawalRequest | null>;
    /** 驳回：状态 REJECTED 并退回冻结金额 */
    rejectRiderWithdraw(ctx: RequestContext, id: ID, remark?: string): Promise<import("./rider-withdrawal.entity").RiderWithdrawalRequest | null>;
}
