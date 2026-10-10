import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 房量日历（房型 × 逐日）：P1 防超订的房量事实表。
 * - 无行时回退变体 hotelRoomConfig.totalRooms；两者都无 → 不限房（沿用既有行为）
 * - date 为入住当晚归属（date-only 字符串，跨库铁律：varchar 存 YYYY-MM-DD，不用日期列）
 */
@Entity()
@Index('uk_hotel_room_day', ['productVariantId', 'date'], { unique: true })
export class HotelRoomDay extends VendureEntity {
    constructor(input?: DeepPartial<HotelRoomDay>) {
        super(input);
    }

    @Index()
    @Column()
    productVariantId: number;

    @Column({ type: 'varchar', length: 10 })
    date: string; // YYYY-MM-DD

    @Column({ type: 'int' })
    totalRooms: number;

    /** 关房（主动停售）：closed 当日 remaining 视为 0 */
    @Column({ default: false })
    closed: boolean;
}
