import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToOne } from 'typeorm';

import { LocalizedText, localizedTextColumn } from './localize';

/**
 * 出售型券包：购买一次按 CouponBundleItem 循环生成包内全部券。
 * 名称/说明为 LocalizedText（存 text 列，transformer 序列化）。
 */
@Entity()
export class CouponBundle extends VendureEntity {
    constructor(input?: DeepPartial<CouponBundle>) {
        super(input);
    }

    @Column('text', { nullable: false, transformer: localizedTextColumn })
    name: LocalizedText;

    @Column('text', { nullable: true, transformer: localizedTextColumn })
    description?: LocalizedText;

    /** 整包售价（分） */
    @Column({ type: 'int' })
    salePrice: number;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    /** 发行归属店铺（店铺隔离，null = 平台级） */
    @Column({ type: 'int', nullable: true })
    shopId: number | null;

    @ManyToOne(() => Channel, { eager: false })
    channel: Channel;

    @Column()
    channelId: number;
}

/** 券包内单项：某券模板在包内的张数 */
@Entity()
export class CouponBundleItem extends VendureEntity {
    constructor(input?: DeepPartial<CouponBundleItem>) {
        super(input);
    }

    @Column({ type: 'int' })
    bundleId: number;

    @Column({ type: 'int' })
    templateId: number;

    @Column({ type: 'int', default: 1 })
    quantity: number;
}