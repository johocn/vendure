// e:\code\vendure\packages\inventory-plugin\src\entities\stocktake-order.entity.ts
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, ID, StockLocation, VendureEntity } from '@vendure/core';

import { StocktakeState } from '../constants';

@Entity()
export class StocktakeOrder extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeOrder>) {
        super(input);
    }

    @Column() code: string;
    @Column({ default: 'Pending' }) state: StocktakeState;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;

    @ManyToOne(() => StockLocation)
    location: StockLocation;
    @Column() locationId: ID;

    @OneToMany(() => StocktakeOrderLine, line => line.order)
    lines: StocktakeOrderLine[];

    @Column({ type: 'timestamp', nullable: true }) countingStartedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) reconcilingStartedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}

@Entity()
export class StocktakeOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeOrderLine>) {
        super(input);
    }

    @ManyToOne(() => StocktakeOrder) order: StocktakeOrder;
    @Column() orderId: ID;
    @Column() productVariantId: ID;
    @Column() systemQuantity: number;
    @Column({ default: 0 }) countedQuantity: number;
    @Column({ default: 0 }) difference: number;
    @Column({ default: false }) reconciled: boolean;
}
