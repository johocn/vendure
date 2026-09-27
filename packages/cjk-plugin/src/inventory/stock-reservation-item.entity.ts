import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type FulfillType = 'CLICK_COLLECT' | 'SHIP';

@Entity('stock_reservation_item')
export class StockReservationItemEntity {
    @PrimaryGeneratedColumn('increment')
    id!: number;

    @Column({ type: 'int' })
    reservationId!: number;

    @Column({ type: 'int' })
    stockLocationId!: number; // 出库物理仓

    @Column({ type: 'int' })
    qty!: number; // 剩余待核销数量（部分核销后递减）

    @Column({ type: 'varchar' })
    fulfillType!: FulfillType; // 自提核销 / 配送发货

    @Column({ type: 'varchar' })
    status!: 'PENDING' | 'DONE';
}