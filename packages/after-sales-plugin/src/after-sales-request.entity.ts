import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, Customer, DeepPartial, Order, OrderLine, VendureEntity } from '@vendure/core';

import { AfterSalesState, AfterSalesType } from './types';

@Entity()
export class AfterSalesRequest extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<AfterSalesRequest>) {
        super(input);
    }

    @ManyToOne(() => Order)
    order: Order;

    @Column()
    orderId: number;

    @ManyToOne(() => OrderLine, { nullable: true })
    orderLine: OrderLine | null;

    @Column({ type: 'int', nullable: true })
    orderLineId: number | null;

    @Column({ default: 'return_refund' })
    type: AfterSalesType;

    @Column({ default: 'Pending' })
    state: AfterSalesState;

    @Column()
    reason: string;

    @Column({ nullable: true, type: 'text' })
    description: string | null;

    @Column('simple-json', { nullable: true })
    evidenceImages: string[] | null;

    @Column()
    refundAmount: number;

    /** 实收数量（部分退货按实收回补；null 表示全额按订单行数量回补） */
    @Column({ type: 'int', nullable: true })
    receivedQuantity: number | null;

    @Column({ type: 'varchar', nullable: true })
    returnTrackingNo: string | null;

    @Column({ type: 'varchar', nullable: true })
    returnCarrier: string | null;

    @Column({ nullable: true, type: 'text' })
    rejectReason: string | null;

    @ManyToOne(() => Customer)
    customer: Customer;

    @Column()
    customerId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
