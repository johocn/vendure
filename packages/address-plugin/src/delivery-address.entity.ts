import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 顾客收货地址（中国化字段：省市区 + 详细地址 + 经纬度）。
 * 按 customerId 强隔离；isDefault 同顾客唯一。
 */
@Entity()
@Index(['customerId', 'isDefault'])
export class DeliveryAddress extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<DeliveryAddress>) {
        super(input);
    }

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'varchar' })
    fullName: string;

    @Column({ type: 'varchar' })
    phone: string;

    @Column({ type: 'varchar', nullable: true })
    province: string | null;

    @Column({ type: 'varchar', nullable: true })
    city: string | null;

    @Column({ type: 'varchar', nullable: true })
    district: string | null;

    @Column({ type: 'varchar', nullable: true })
    provinceCode: string | null;

    @Column({ type: 'varchar', nullable: true })
    cityCode: string | null;

    @Column({ type: 'varchar', nullable: true })
    districtCode: string | null;

    @Column({ type: 'varchar', nullable: true })
    detail: string | null;

    @Column({ type: 'float', nullable: true })
    lng: number | null;

    @Column({ type: 'float', nullable: true })
    lat: number | null;

    @Column({ type: 'boolean', default: false })
    isDefault: boolean;

    @Column({ type: 'int' })
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}