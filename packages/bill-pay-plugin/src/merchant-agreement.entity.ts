import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { BillPaySettleMode } from './types';

/**
 * 商家协议表（P0 轻量）：渠道内按商家名唯一，维护协议结算费率。
 */
@Entity('merchant_agreement')
@Index(['channelId', 'merchantName'], { unique: true })
export class MerchantAgreement extends VendureEntity {
    constructor(input?: DeepPartial<MerchantAgreement>) {
        super(input);
    }

    @Index()
    @Column({ type: 'int' })
    channelId: number;

    @Column({ type: 'varchar' })
    merchantName: string;

    /** 关联商户 id（merchant 表；为空表示历史仅按名称维护的协议） */
    @Index()
    @Column({ type: 'int', nullable: true })
    merchantId: number | null;

    /** 协议结算费率（百分数整数，85 = 8.5 折）：t3 向商家支付的成本口径 */
    @Column({ type: 'int' })
    settleRate: number;

    /** PER_ORDER（现付）/ MONTHLY（月结，P1） */
    @Column({ type: 'varchar' })
    settleMode: BillPaySettleMode;

    @Column({ type: 'varchar', nullable: true })
    contact: string | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;
}
