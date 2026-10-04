import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { LiveRoom } from './live-room.entity';

@Entity()
export class LiveRoomPlatform extends VendureEntity {
    constructor(input?: DeepPartial<LiveRoomPlatform>) {
        super(input);
    }

    @Index()
    @ManyToOne(() => LiveRoom, room => room.platforms, { onDelete: 'CASCADE' })
    liveRoom: LiveRoom;

    /** 平台标识：douyin / kuaishou / wechat_channels / 预留扩展（^[a-z0-9_]{2,32}$） */
    @Column({ type: 'varchar', length: 32 })
    platform: string;

    /**
     * 平台落地信息：
     * - douyin/kuaishou: http(s) 直播间链接
     * - wechat_channels: wxchannels://finder=<视频号ID>(&feed=<feedId>)?
     */
    @Column({ type: 'varchar', length: 512 })
    externalUrl: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
