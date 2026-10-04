import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

@Entity()
export class CampusZone extends VendureEntity {
    [key: string]: any;
    @Column() name: string; // 如「A 区」
    @Column({ type: 'int' }) fee: number; // 该区配送费（分）
    @Column() channelId: ID;
    constructor(input?: DeepPartial<CampusZone>) {
        super(input);
    }
}
