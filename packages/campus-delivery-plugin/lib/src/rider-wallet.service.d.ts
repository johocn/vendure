import { RequestContext, RequestContextService, TransactionalConnection } from '@vendure/core';
import { BalanceTransaction } from '@vendure/recharge-card-plugin';
import { RiderService } from './rider.service';
import { RiderWithdrawalRequest } from './rider-withdrawal.entity';
/** 骑手钱包：余额底座复用 coupon-balance-port（recharge-card CustomerBalance）。
 * 提现即扣减余额（冻结语义：frozen = PENDING 申请合计），驳回退回、打款仅留痕。
 * 骑手为平台级能力：资金操作与流水的渠道上下文固定为默认渠道（platformCtx），
 * 不随调用方（骑手端无渠道头、管理端选店）的 channelToken 漂移。 */
export declare class RiderWalletService {
    private connection;
    private riderService;
    private requestContextService;
    constructor(connection: TransactionalConnection, riderService: RiderService, requestContextService: RequestContextService);
    /** 默认渠道上下文：余额端口与提现记录统一在此渠道下读写 */
    private platformCtx;
    myRiderWallet(ctx: RequestContext): Promise<{
        available: number;
        frozen: number;
        totalEarned: number;
    }>;
    /** 余额流水（recharge-card BalanceTransaction，默认渠道本人倒序） */
    riderBalanceHistory(ctx: RequestContext, skip?: number, take?: number): Promise<BalanceTransaction[]>;
    /** 本人提现申请记录（平台级，倒序） */
    riderWithdrawRequests(ctx: RequestContext, skip?: number, take?: number): Promise<RiderWithdrawalRequest[]>;
    /** 提现申请：校验骑手 + ≥¥10 + ≤可提现 → 扣款冻结 → PENDING 申请 */
    riderWithdraw(ctx: RequestContext, input: {
        amount: number;
        channel: string;
        account: string;
    }): Promise<any>;
    /** 管理端：提现申请列表（status=ALL 或具体状态；平台级，不限定选店渠道） */
    adminList(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<RiderWithdrawalRequest[]>;
    /** 管理端：通过打款（仅留痕，金额已在申请时扣减） */
    adminApprove(ctx: RequestContext, id: any, remark?: string): Promise<RiderWithdrawalRequest | null>;
    /** 管理端：驳回（退回冻结金额 + 留痕；退回资金固定默认渠道，与申请扣款同渠道） */
    adminReject(ctx: RequestContext, id: any, remark?: string): Promise<RiderWithdrawalRequest | null>;
    private reviewer;
    /** 审核前置校验（平台级：不限定 channelId） */
    private getForReview;
    private sumPending;
    private sumEarned;
}
