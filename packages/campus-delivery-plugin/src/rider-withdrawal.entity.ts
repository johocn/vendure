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
    constructor(input?: DeepPartial<RiderWithdrawalRequest>) {
        super(input);
    }
}
