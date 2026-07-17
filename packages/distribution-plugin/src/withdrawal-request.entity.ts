import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class WithdrawalRequest extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<WithdrawalRequest>) {
        super(input);
    }

    @Column() distributorId: string;

    @Column({ type: 'int' }) amount: number;

    @Column({ type: 'varchar' }) method: 'bank' | 'alipay' | 'wechat';

    // 密文存储：由 WithdrawalService 在写入前调用 encryptAccount、读取时调用 decryptAccount
    @Column({ type: 'text' }) accountInfo: string;

    @Column({ type: 'varchar', default: 'pending' }) status: 'pending' | 'approved' | 'rejected' | 'paid';

    @Column({ nullable: true }) reviewedAt: Date;

    @Column({ nullable: true }) paidAt: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
