// e:\code\vendure\packages\inventory-plugin\src\entities\stocktake-order.entity.ts
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, EntityId, ID, StockLocation, VendureEntity } from '@vendure/core';

import { StocktakeState } from '../constants';

@Entity()
export class StocktakeOrder extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeOrder>) {
        super(input);
    }

    @Column() code: string;
    @Column({ type: 'varchar', default: 'Pending' }) state: StocktakeState;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;

    @ManyToOne(() => StockLocation)
    location: StockLocation;
    @EntityId() locationId: ID;

    @OneToMany(() => StocktakeOrderLine, line => line.order, { cascade: true })
    lines: StocktakeOrderLine[];

    @Column({ nullable: true }) countingStartedAt?: Date;
    @Column({ nullable: true }) reconcilingStartedAt?: Date;
    @Column({ nullable: true }) completedAt?: Date;
    @Column({ nullable: true }) cancelledAt?: Date;

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
    @EntityId() orderId: ID;
    @EntityId() productVariantId: ID;
    @Column() systemQuantity: number;
    @Column({ default: 0 }) countedQuantity: number;
    @Column({ default: 0 }) difference: number;
    @Column({ default: false }) reconciled: boolean;
}
