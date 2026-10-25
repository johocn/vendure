import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/** 骑手位置历史轨迹（P8-4）：实时位置仍写 Order.customFields.riderLat/riderLng 供 C 端跟踪，
 * 本表只做留痕（配送中每 10s 一条，30 天后由调度任务清理）。 */
@Entity()
@Index('idx_campus_rider_location_order', ['orderId', 'reportedAt'])
@Index('idx_campus_rider_location_rider', ['channelId', 'riderCustomerId', 'reportedAt'])
export class CampusRiderLocation extends VendureEntity {
    [key: string]: any;
    @Column('int') channelId: ID;
    @Column('int') orderId: ID;
    @Column('int') riderCustomerId: ID;
    @Column({ type: 'float' }) lat: number;
    @Column({ type: 'float' }) lng: number;
    @Column({ type: 'timestamptz' }) reportedAt: Date;
    constructor(input?: DeepPartial<CampusRiderLocation>) {
        super(input);
    }
}
