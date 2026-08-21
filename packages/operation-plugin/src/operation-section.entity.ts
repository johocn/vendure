import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

import { OperationItem } from './operation-item.entity';

/**
 * 运营位/专区楼层。
 * 一段可后台配置的首页楼层，承载一组 OperationItem 条目（banner/商品/链接）。
 * - code 全局唯一，C 端按 code 精准拉取；type 决定渲染形态（banner/products/link）。
 * - enabled 启停开关：shop-api 只输出 enabled 的专区。
 * - position 楼层排序（越大越靠前）。
 */
@Entity()
@Index(['channelId', 'enabled', 'position'])
export class OperationSection extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<OperationSection>) {
        super(input);
    }

    @Column({ type: 'varchar', unique: true })
    code: string;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'varchar' })
    type: string;

    @Column({ type: 'varchar', nullable: true })
    displayMode: string | null;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @Column({ type: 'int', default: 0 })
    position: number;

    @Column({ type: 'int' })
    channelId: number;

    @OneToMany(() => OperationItem, item => item.section)
    items: OperationItem[];

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}