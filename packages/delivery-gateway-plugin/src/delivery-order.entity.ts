import { Column, Entity } from 'typeorm';
import { DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { DeliveryStatus } from './delivery-provider';

@Entity()
export class DeliveryOrder extends VendureEntity {
    constructor(input?: DeepPartial<DeliveryOrder>) {
        super(input);
    }

    @Column() code: string;
    @EntityId() orderId: ID;
    @Column({ nullable: true }) packageId: string;
    @EntityId({ nullable: true }) fulfillmentId: ID | null;
    @Column() providerCode: string;
    @Column({ nullable: true }) thirdPartyNo: string;
    @Column() status: DeliveryStatus;
    @Column({ type: 'text', nullable: true }) pickupJson: string;
    @Column({ type: 'text', nullable: true }) dropoffJson: string;
    @Column({ type: 'text', nullable: true }) itemsJson: string;
    @Column({ type: 'int', nullable: true }) fee: number;
    @Column({ type: 'int', nullable: true }) etaMinutes: number;
    @Column({ nullable: true }) courierName: string;
    @Column({ nullable: true }) courierPhone: string;
    @Column({ nullable: true }) acceptedAt: Date;
    @Column({ nullable: true }) pickupAt: Date;
    @Column({ nullable: true }) deliveredAt: Date;
    @Column({ nullable: true }) cancelledAt: Date;
    @Column({ nullable: true }) reason: string;
}
