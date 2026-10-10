import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

export type HotelBookingLockStatus = 'hold' | 'booked' | 'released';

/**
 * 锁房单（房型 × 晚 × 1 间）：占用事实表，不反查订单行。
 * - 一行 = 1 间房 × 1 晚；同一订单行 N 晚 × M 间 = N×M 行 lock
 * - orderLineId 可空：OrderInterceptor 校验阶段（行未创建）先按 orderId 落 hold，
 *   行创建后（建 booking / confirm 时）反查补填
 * - released 行保留作审计，不参与占用统计
 * - 占用口径：status ∈ {hold(未过期), booked}
 */
@Entity()
@Index('idx_hotel_booking_lock_order', ['orderId', 'productVariantId'])
@Index('idx_hotel_booking_lock_day', ['productVariantId', 'date', 'status'])
export class HotelBookingLock extends VendureEntity {
    constructor(input?: DeepPartial<HotelBookingLock>) {
        super(input);
    }

    @Index()
    @Column()
    productVariantId: number;

    @Column({ type: 'varchar', length: 10 })
    date: string; // YYYY-MM-DD（被占用的晚）

    @Index()
    @Column()
    orderId: number;

    @Column({ type: 'int', nullable: true })
    orderLineId: number | null;

    /** P3 建 booking 后回填 */
    @Column({ type: 'int', nullable: true })
    bookingId: number | null;

    @Column({ type: 'varchar', length: 20, default: 'hold' })
    status: HotelBookingLockStatus;

    /** hold 过期时间（默认 15min）；booked/released 为 null */
    @Column({ nullable: true })
    holdExpiresAt: Date | null;
}
