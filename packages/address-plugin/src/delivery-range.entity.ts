import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 商家配送范围（一店一档）。关联 shop-plugin 的 Shop（shopId）。
 * rangeType: all 不限 / circle 圆心半径(km) / district 省市区白名单。
 * districtCodes 存 JSON 文本数组，跨库安全，服务内 JSON.parse。
 */
@Entity()
@Index(['shopId', 'channelId'], { unique: true })
export class DeliveryRange extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<DeliveryRange>) {
        super(input);
    }

    @Column({ type: 'int' })
    shopId: number;

    @Column({ type: 'boolean', default: false })
    enabled: boolean;

    @Column({ type: 'varchar', default: 'all' })
    rangeType: string;

    @Column({ type: 'float', nullable: true })
    centerLng: number | null;

    @Column({ type: 'float', nullable: true })
    centerLat: number | null;

    @Column({ type: 'float', nullable: true })
    radiusKm: number | null;

    @Column({ type: 'varchar', nullable: true })
    districtCodes: string | null;

    @Column({ type: 'int' })
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}