import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class CampusBuilding extends VendureEntity {
    [key: string]: any;
    @Column() name: string; // 如「桂3栋」
    @Column({ nullable: true }) detail: string; // 单元/楼层提示
    @Column() zoneId: ID;
    @Column() channelId: ID;
    constructor(input?: DeepPartial<CampusBuilding>) {
        super(input);
    }
}
