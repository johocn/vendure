// e:\code\vendure\packages\inventory-plugin\src\entities\stock-move-order.entity.ts
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, EntityId, ID, StockLocation, VendureEntity } from '@vendure/core';

import { StockMoveState } from '../constants';

@Entity()
export class StockMoveOrder extends VendureEntity {
    constructor(input?: DeepPartial<StockMoveOrder>) {
        super(input);
    }

    @Column() code: string;
    @Column({ type: 'varchar', default: 'Pending' }) state: StockMoveState;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;

    @ManyToOne(() => StockLocation)
    sourceLocation: StockLocation;
    @EntityId() sourceLocationId: ID;

    @ManyToOne(() => StockLocation)
    targetLocation: StockLocation;
    @EntityId() targetLocationId: ID;

    @OneToMany(() => StockMoveOrderLine, line => line.order, { cascade: true })
    lines: StockMoveOrderLine[];

    @Column({ nullable: true }) shippedAt?: Date;
    @Column({ nullable: true }) receivedAt?: Date;
    @Column({ nullable: true }) completedAt?: Date;
    @Column({ nullable: true }) cancelledAt?: Date;

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
    @EntityId() orderId: ID;
    @EntityId() productVariantId: ID;
    @Column() quantity: number;
}
