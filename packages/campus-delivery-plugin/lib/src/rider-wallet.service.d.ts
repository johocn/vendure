import { RequestContext, TransactionalConnection } from '@vendure/core';
import { BalanceTransaction } from '@vendure/recharge-card-plugin';
import { RiderService } from './rider.service';
import { RiderWithdrawalRequest } from './rider-withdrawal.entity';
/** 骑手钱包：余额底座复用 coupon-balance-port（recharge-card CustomerBalance）。
 * 提现即扣减余额（冻结语义：frozen = PENDING 申请合计），驳回退回、打款仅留痕。 */
export declare class RiderWalletService {
    private connection;
    private riderService;
    constructor(connection: TransactionalConnection, riderService: RiderService);
    myRiderWallet(ctx: RequestContext): Promise<{
        available: number;
        frozen: number;
        totalEarned: number;
    }>;
    /** 余额流水（recharge-card BalanceTransaction，本渠道本人倒序） */
    riderBalanceHistory(ctx: RequestContext, skip?: number, take?: number): Promise<BalanceTransaction[]>;
    /** 本人提现申请记录（倒序） */
    riderWithdrawRequests(ctx: RequestContext, skip?: number, take?: number): Promise<RiderWithdrawalRequest[]>;
    /** 提现申请：校验骑手 + ≥¥10 + ≤可提现 → 扣款冻结 → PENDING 申请 */
    riderWithdraw(ctx: RequestContext, input: {
        amount: number;
        channel: string;
        account: string;
    }): Promise<any>;
    /** 管理端：提现申请列表（status=ALL 或具体状态，渠道隔离） */
    adminList(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<RiderWithdrawalRequest[]>;
    /** 管理端：通过打款（仅留痕，金额已在申请时扣减） */
    adminApprove(ctx: RequestContext, id: any, remark?: string): Promise<RiderWithdrawalRequest | null>;
    /** 管理端：驳回（退回冻结金额 + 留痕） */
    adminReject(ctx: RequestContext, id: any, remark?: string): Promise<RiderWithdrawalRequest | null>;
    private reviewer;
    private getForReview;
    private sumPending;
    private sumEarned;
}
