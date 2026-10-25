import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
@Index(['channelId', 'status'])
export class RiderWithdrawalRequest extends VendureEntity {
    [key: string]: any;
    @Column('int') customerId: number;
    @Column('int') channelId: number;
    @Column({ type: 'int' }) amount: number; // 提现金额（分）
    @Column({ type: 'varchar' }) channel: string; // 收款渠道：支付宝 / 微信
    @Column({ type: 'varchar' }) account: string; // 收款账号
    @Column({ type: 'varchar', default: 'PENDING' }) status: 'PENDING' | 'PAID' | 'REJECTED';
    @Column({ type: 'varchar', nullable: true }) remark: string | null;
    @Column({ type: 'varchar', nullable: true }) reviewedBy: string | null;
    @Column({ type: 'timestamp', nullable: true }) reviewedAt: Date | null;
    /** 打款流水号（通过时必填，用于对账留痕） */
    @Column({ type: 'varchar', nullable: true }) payoutRef: string | null;
    /** 打款凭证（转账截图/回单 URL） */
    @Column({ type: 'varchar', nullable: true }) payoutProof: string | null;
    constructor(input?: DeepPartial<RiderWithdrawalRequest>) {
        super(input);
    }
}
