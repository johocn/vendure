import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
@Index(['customerId', 'checkinDate', 'channelId'], { unique: true })
export class CheckinRecord extends VendureEntity {
    constructor(input?: DeepPartial<CheckinRecord>) {
        super(input);
    }
    @Column({ type: 'int' })
    channelId: number;
    @Column({ type: 'int' })
    customerId: number;
    /** YYYY-MM-DD（本地时区） */
    @Column({ type: 'varchar', length: 10 })
    checkinDate: string;
    @Column({ type: 'int' })
    points: number;
    @Column({ type: 'int' })
    growth: number;
    /** 结算时的连续签到天数 */
    @Column({ type: 'int' })
    streak: number;
}