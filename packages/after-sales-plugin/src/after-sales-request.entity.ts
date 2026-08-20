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

    @Column({ type: 'varchar', default: 'return_refund' })
    type: AfterSalesType;

    @Column({ type: 'varchar', default: 'Pending' })
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

    /** 多仓回补明细 JSON（[{ stockLocationId, quantity }]）；单仓/旧数据为 null */
    @Column({ type: 'text', nullable: true })
    restockJson: string | null;

    @Column({ type: 'varchar', nullable: true })
    returnTrackingNo: string | null;

    @Column({ type: 'varchar', nullable: true })
    returnCarrier: string | null;

    @Column({ nullable: true, type: 'text' })
    rejectReason: string | null;

    /** 支付网关退款流水号（退款成功后落） */
    @Column({ type: 'varchar', nullable: true })
    refundTransactionId: string | null;

    /** 实际退款到账金额（退款成功后落） */
    @Column({ type: 'int', nullable: true })
    actualRefundAmount: number | null;

    /** 退款完成时间（Refund 达 Settled 时落） */
    @Column({ nullable: true })
    refundedAt?: Date;

    /** 退款失败原因（RefundFailed 留痕，重试成功前保留） */
    @Column({ nullable: true, type: 'text' })
    refundError: string | null;

    @ManyToOne(() => Customer)
    customer: Customer;

    @Column()
    customerId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
