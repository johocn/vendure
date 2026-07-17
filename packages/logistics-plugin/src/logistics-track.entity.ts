import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class LogisticsTrack extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<LogisticsTrack>) {
        super(input);
    }

    @Column() fulfillmentId: number;

    @Column() trackingNo: string;

    @Column() carrierCode: string;

    @Column({ type: 'varchar', default: 'unknown' }) status: string; // unknown/in_transit/delivered/rejected/returned

    @Column({ type: 'text', nullable: true }) trackInfo: string | null; // JSON: 物流轨迹详情

    @Column({ type: 'timestamptz', nullable: true }) signedAt: Date | null; // 签收时间

    @Column({ type: 'text', nullable: true }) lastError: string | null;

    @Column({ type: 'timestamptz', nullable: true }) lastSyncedAt: Date | null;

    @ManyToOne(() => Channel) channel: Channel;

    @Column() channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
