import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 商家店铺档案主体（区别于 Channel 租户维度）。
 * 评分/商品数为普通缓存列（service 实时重算后写回），不参与对外 customFields。
 */
@Entity()
export class Shop extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Shop>) {
        super(input);
    }

    @Column({ type: 'varchar' })
    name: string;

    /** 唯一 slug，用于 C 端 URL 与查询。 */
    @Column({ type: 'varchar', unique: true })
    slug: string;

    @Column({ type: 'int', nullable: true })
    logoAssetId: number | null;

    @Column({ type: 'int', nullable: true })
    bannerAssetId: number | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    /** applicant | active | closed */
    @Column({ type: 'varchar', default: 'applicant' })
    status: string;

    /** 店主后台账号主键（Administrator.id）。归属解析：activeUserId→Administrator.user→this.administratorId。 */
    @Column({ type: 'int', nullable: true })
    administratorId: number | null;

    @Column({ type: 'int' })
    channelId: number;

    /** 评分缓存列（service 实时聚合后写回，供列表/店铺页直接读取，避免 N+1）。 */
    @Column({ type: 'float', nullable: true })
    shopRating: number | null;

    @Column({ type: 'int', nullable: true })
    shopReviewCount: number | null;

    @Column({ type: 'int', nullable: true })
    shopProductCount: number | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}