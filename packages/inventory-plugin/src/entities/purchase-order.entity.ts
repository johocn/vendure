// e:\code\vendure\packages\inventory-plugin\src\entities\purchase-order.entity.ts
import { Column, Entity, ManyToMany, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, EntityId, ID, StockLocation, VendureEntity } from '@vendure/core';

import { PurchaseOrderState } from '../constants';
import { Supplier } from './supplier.entity';

@Entity()
export class PurchaseOrder extends VendureEntity {
    constructor(input?: DeepPartial<PurchaseOrder>) {
        super(input);
    }

    @Column() code: string;
    @Column({ type: 'varchar', default: 'Draft' }) state: PurchaseOrderState;

    @ManyToOne(() => Supplier)
    supplier: Supplier;
    @EntityId() supplierId: ID;

    @ManyToOne(() => StockLocation)
    targetLocation: StockLocation;
    @EntityId() targetLocationId: ID;

    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;
    @Column({ nullable: true }) orderDate: Date;
    @Column({ nullable: true }) expectedArrivalDate: Date;
    /** 总投资额（分，按订购量×单价汇总） */
    @Column({ type: 'int', default: 0 }) totalAmount: number;

    @OneToMany(() => PurchaseOrderLine, line => line.order, { cascade: true })
    lines: PurchaseOrderLine[];

    @Column({ nullable: true }) orderedAt: Date;
    @Column({ nullable: true }) completedAt: Date;
    @Column({ nullable: true }) cancelledAt: Date;

    @Column({ type: 'int' }) channelId: number;
    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}

@Entity()
export class PurchaseOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<PurchaseOrderLine>) {
        super(input);
    }

    @ManyToOne(() => PurchaseOrder) order: PurchaseOrder;
    @EntityId() orderId: ID;
    @EntityId() productVariantId: ID;
    /** 订购量 */
    @Column() quantity: number;
    /** 累计实收 */
    @Column({ type: 'int', default: 0 }) receivedQuantity: number;
    /** 含税单价（分） */
    @Column({ type: 'int', nullable: true }) unitPrice: number | null;

    get amount(): number {
        return (this.unitPrice ?? 0) * this.quantity;
    }
}