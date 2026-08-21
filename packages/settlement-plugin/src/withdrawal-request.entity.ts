import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/** 提现申请：状态机 pending→approved→paid / pending→rejected。金额「分」整数。 */
@Entity()
export class WithdrawalRequest extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<WithdrawalRequest>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    @Column({ type: 'int' })
    shopId: number;

    @Column({ type: 'int' })
    amount: number;

    /** pending | approved | paid | rejected */
    @Column({ type: 'varchar', default: 'pending' })
    status: string;

    @Column({ type: 'varchar', nullable: true })
    reviewNote: string | null;

    @Column({ nullable: true })
    paidAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}