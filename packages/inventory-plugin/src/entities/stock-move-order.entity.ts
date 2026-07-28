// e:\code\vendure\packages\inventory-plugin\src\entities\stock-move-order.entity.ts
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, ID, StockLocation, VendureEntity } from '@vendure/core';

import { StockMoveState } from '../constants';

@Entity()
export class StockMoveOrder extends VendureEntity {
    constructor(input?: DeepPartial<StockMoveOrder>) {
        super(input);
    }

    @Column() code: string;
    @Column({ default: 'Pending' }) state: StockMoveState;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;

    @ManyToOne(() => StockLocation)
    sourceLocation: StockLocation;
    @Column() sourceLocationId: ID;

    @ManyToOne(() => StockLocation)
    targetLocation: StockLocation;
    @Column() targetLocationId: ID;

    @OneToMany(() => StockMoveOrderLine, line => line.order)
    lines: StockMoveOrderLine[];

    @Column({ type: 'timestamp', nullable: true }) shippedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) receivedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}

@Entity()
export class StockMoveOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StockMoveOrderLine>) {
        super(input);
    }

    @ManyToOne(() => StockMoveOrder) order: StockMoveOrder;
    @Column() orderId: ID;
    @Column() productVariantId: ID;
    @Column() quantity: number;
}
