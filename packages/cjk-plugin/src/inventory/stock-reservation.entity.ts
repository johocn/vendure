import { Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

export type ReservationStatus = 'PENDING_ALLOC' | 'ALLOCATED' | 'DONE' | 'RELEASED';

@Entity('stock_reservation')
export class StockReservationEntity {
    @PrimaryGeneratedColumn('increment')
    id!: number;

    @Index()
    @Column()
    orderId!: number;

    @Column({ nullable: true })
    orderLineId!: number;

    @Column()
    variantId!: number;

    @Column({ type: 'int' })
    totalQty!: number; // 下单预占量

    @Column()
    status!: ReservationStatus;

    @Column({ nullable: true })
    tenantChannelId!: string;

    @Column()
    createdAt!: Date;
}