import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class WithdrawalRequest extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<WithdrawalRequest>) {
        super(input);
    }

    @Column() distributorId: string;

    @Column() amount: number;

    @Column() method: 'bank' | 'alipay' | 'wechat';

    @Column() accountInfo: string;

    @Column({ default: 'pending' }) status: 'pending' | 'approved' | 'rejected' | 'paid';

    @Column({ type: 'datetime', nullable: true }) reviewedAt: Date;

    @Column({ type: 'datetime', nullable: true }) paidAt: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
