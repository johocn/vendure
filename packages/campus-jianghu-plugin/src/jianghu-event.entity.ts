import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/**
 * 江湖事件（方向二多人拼图 / 方向三剧本母版）。
 * collected 由运营或脚本更新；参与者均分 rewardPoolRep。
 */
@Entity('jianghu_event')
export class JianghuEvent extends VendureEntity {
    [key: string]: any;

    constructor(input?: DeepPartial<JianghuEvent>) {
        super(input);
    }

    @Column({ type: 'varchar' })
    name: string;
    @Column({ type: 'text' })
    desc: string;
    /** 线索总数 */
    @Column('int', { default: 6 })
    total: number;
    /** 已收集数 */
    @Column('int', { default: 0 })
    collected: number;
    /** 单人最多贡献条数 */
    @Column('int', { default: 2 })
    perPersonLimit: number;
    @Column({ type: 'varchar', nullable: true })
    endAt: string | null;
    @Column('int', { nullable: true })
    rewardPoolRep: number | null;
}
