import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class CampusBuilding extends VendureEntity {
    [key: string]: any;
    @Column() name: string; // 如「桂3栋」
    @Column({ nullable: true }) detail: string; // 单元/楼层提示
    /** 楼栋坐标（gcj02，与骑手上报坐标系一致）；历史数据可空，跟踪页降级只显示骑手 */
    @Column({ type: 'double precision', nullable: true }) lat: number;
    @Column({ type: 'double precision', nullable: true }) lng: number;
    @Column('int') zoneId: ID;
    @Column('int') channelId: ID;
    constructor(input?: DeepPartial<CampusBuilding>) {
        super(input);
    }
}
