import { Customer, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

/**
 * 情报集市条目（方向二）。仅承载公开信息；sourceNote 必填，合规留痕。
 * 审核通过 (APPROVED) 才上架；违规内容 REJECTED。
 */
@Entity('jianghu_intel')
@Index(['campusCode'])
@Index(['status'])
export class JianghuIntel extends VendureEntity {
    [key: string]: any;

    constructor(input?: DeepPartial<JianghuIntel>) {
        super(input);
    }

    @Column({ type: 'varchar' })
    category: 'FOOD' | 'CLASSROOM' | 'CLUB' | 'EVENT' | 'NOTICE' | 'SCENERY';
    @Column({ type: 'varchar', nullable: true })
    campusCode: string | null;
    /** 打码标题 */
    @Column({ type: 'varchar' })
    summary: string;
    /** 解锁后可见正文 */
    @Column({ type: 'text', nullable: true })
    content: string | null;
    /** 信息来源（必填） */
    @Column({ type: 'varchar' })
    sourceNote: string;
    @Column('int', { default: 5 })
    priceIntel: number;
    @Column('int', { default: 0 })
    viewCount: number;
    @Column('int', { nullable: true })
    authorCustomerId: number | null;
    @Column({ type: 'varchar', default: 'PENDING' })
    status: 'PENDING' | 'APPROVED' | 'REJECTED';

    @ManyToOne(() => Customer)
    author?: Customer;
}
