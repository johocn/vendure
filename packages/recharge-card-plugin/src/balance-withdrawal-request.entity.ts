import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToOne } from 'typeorm';

@Entity()
export class BalanceWithdrawalRequest extends VendureEntity {
    constructor(input?: DeepPartial<BalanceWithdrawalRequest>) {
        super(input);
    }

    @Column() customerId: number;

    @Column({ type: 'int' }) amount: number; // 分

    @Column({ type: 'varchar' }) method: 'wechat' | 'alipay' | 'bank';

    @Column({ type: 'text' }) accountInfo: string; // 收款账号（展示与打款用）

    @Column({ type: 'varchar', default: 'pending' }) status: 'pending' | 'approved' | 'rejected' | 'paid';

    @Column({ type: 'text', nullable: true }) remark: string | null;

    // 日期列省略 type：由 design:type=Date 按驱动推断（sqlite→datetime、postgres→timestamp），
    // 显式 'datetime' 只兼容 postgres、显式 'timestamp' 只兼容 postgres，sqljs e2e 均会挂
    @Column({ nullable: true }) reviewedAt: Date;

    @Column({ nullable: true }) paidAt: Date;

    @ManyToOne(() => Channel)
    channel: Channel;

    @Column()
    channelId: number;
}
