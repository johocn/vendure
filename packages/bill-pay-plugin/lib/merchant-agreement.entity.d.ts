import { DeepPartial, VendureEntity } from '@vendure/core';
import { BillPaySettleMode } from './types';
/**
 * 商家协议表（P0 轻量）：渠道内按商家名唯一，维护协议结算费率。
 */
export declare class MerchantAgreement extends VendureEntity {
    constructor(input?: DeepPartial<MerchantAgreement>);
    channelId: number;
    merchantName: string;
    /** 关联商户 id（merchant 表；为空表示历史仅按名称维护的协议） */
    merchantId: number | null;
    /** 协议结算费率（百分数整数，85 = 8.5 折）：t3 向商家支付的成本口径 */
    settleRate: number;
    /** PER_ORDER（现付）/ MONTHLY（月结，P1） */
    settleMode: BillPaySettleMode;
    contact: string | null;
    note: string | null;
}
