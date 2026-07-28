// e:\code\vendure\packages\inventory-plugin\src\entities\stock-in-order.entity.ts
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, EntityId, ID, StockLocation, VendureEntity } from '@vendure/core';

import { StockInState } from '../constants';

@Entity()
export class StockInOrder extends VendureEntity {
    constructor(input?: DeepPartial<StockInOrder>) {
        super(input);
    }

    @Column() code: string;
    @Column({ default: 'Pending' }) state: StockInState;
    @Column({ nullable: true }) type: string;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;

    @ManyToOne(() => StockLocation)
    targetLocation: StockLocation;
    @EntityId() targetLocationId: ID;

    @OneToMany(() => StockInOrderLine, line => line.order, { cascade: true })
    lines: StockInOrderLine[];

    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}

@Entity()
export class StockInOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StockInOrderLine>) {
        super(input);
    }

    @ManyToOne(() => StockInOrder) order: StockInOrder;
    @EntityId() orderId: ID;
    @EntityId() productVariantId: ID;
    @Column() quantity: number;
    @Column({ type: 'int', nullable: true }) unitPrice: number | null;
}
