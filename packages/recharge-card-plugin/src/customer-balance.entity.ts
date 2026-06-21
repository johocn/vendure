import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { Channel, Customer, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
@Unique(['customer', 'channel'])
export class CustomerBalance extends VendureEntity {
    constructor(input?: DeepPartial<CustomerBalance>) {
        super(input);
    }

    @ManyToOne(() => Customer)
    customer: Customer;

    @Column()
    customerId: number;

    @ManyToOne(() => Channel)
    channel: Channel;

    @Column()
    channelId: number;

    @Column({ default: 0 })
    balance: number;
}
