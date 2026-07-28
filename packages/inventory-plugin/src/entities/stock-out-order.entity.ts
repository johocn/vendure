// e:\code\vendure\packages\inventory-plugin\src\entities\stock-out-order.entity.ts
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, EntityId, ID, StockLocation, VendureEntity } from '@vendure/core';

import { StockOutState } from '../constants';

@Entity()
export class StockOutOrder extends VendureEntity {
    constructor(input?: DeepPartial<StockOutOrder>) {
        super(input);
    }

    @Column() code: string;
    @Column({ default: 'Pending' }) state: StockOutState;
    @Column({ nullable: true }) type: string;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;

    @ManyToOne(() => StockLocation)
    sourceLocation: StockLocation;
    @EntityId() sourceLocationId: ID;

    @OneToMany(() => StockOutOrderLine, line => line.order, { cascade: true })
    lines: StockOutOrderLine[];

    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}

@Entity()
export class StockOutOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StockOutOrderLine>) {
        super(input);
    }

    @ManyToOne(() => StockOutOrder) order: StockOutOrder;
    @EntityId() orderId: ID;
    @EntityId() productVariantId: ID;
    @Column() quantity: number;
    @Column({ type: 'int', nullable: true }) unitPrice: number | null;
}
