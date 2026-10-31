import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class RiderWithdrawalRequest extends VendureEntity {
    [key: string]: any;
    customerId: number;
    channelId: number;
    amount: number;
    channel: string;
    account: string;
    /** FAILED = 已标记打款但实际转账失败（钱已退回骑手余额，需重新申请） */
    status: 'PENDING' | 'PAID' | 'REJECTED' | 'FAILED';
    /**
     * 扣款对账状态（R1）：
     * - intent：申请已落库、尚未确认扣款（余额流水 remark = withdraw:<id> 为对账锚点）
     * - confirmed：扣款已确认，可进入审批
     * - deduct_failed：扣款失败，申请自动作废（不产生退款）
     * 历史行为 NULL（旧流程先扣款后落库，视为已确认）
     */
    withdrawState: 'intent' | 'confirmed' | 'deduct_failed' | null;
    remark: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    /** 打款流水号（通过时必填，用于对账留痕） */
    payoutRef: string | null;
    /** 打款凭证（转账截图/回单 URL） */
    payoutProof: string | null;
    /** 打款失败原因（FAILED 时必填，用于复盘/对账） */
    failReason: string | null;
    constructor(input?: DeepPartial<RiderWithdrawalRequest>);
}
