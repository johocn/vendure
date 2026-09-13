import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { CancelPolicy, HotelConfig, LongStayDiscount, PriceSegment, RoomDetail } from './hotel-config';

/**
 * 房型模板（快照源）：客户在商品变体上应用模板时，
 * 整体深拷贝进变体 customFields hotelRoomConfig，模板后续修改不影响已用商品。
 */
@Entity()
export class RoomTemplate extends VendureEntity {
    constructor(input?: DeepPartial<RoomTemplate>) {
        super(input);
    }

    @Column() code: string;

    @Column({ type: 'text' })
    name: string; // LocalizedText JSON（string=共用文案 / Record<locale,string>=逐语言）

    @Column({ default: true })
    enabled: boolean;

    @Column({ default: 0 })
    sortOrder: number;

    @Column({ type: 'varchar', nullable: true })
    coverAssetId: string | null;

    @Column({ type: 'simple-json', nullable: true })
    specs: HotelConfig['specs'] | null;

    @Column({ type: 'simple-json', nullable: true })
    defaultRooms: RoomDetail[] | null;

    @Column({ type: 'int' })
    basePriceCent: number;

    @Column({ type: 'simple-json', nullable: true })
    priceCalendar: PriceSegment[] | null;

    @Column({ type: 'simple-json', nullable: true })
    longStayDiscount: LongStayDiscount[] | null;

    @Column({ default: 1 })
    minNights: number;

    @Column({ default: 30 })
    maxNights: number;

    @Column({ default: 30 })
    advanceDays: number;

    @Column({ default: '14:00' })
    checkInTime: string;

    @Column({ default: '12:00' })
    checkOutTime: string;

    @Column({ type: 'simple-json' })
    cancelPolicy: CancelPolicy;

    @Column({ default: 'none' })
    depositType: string;
}
