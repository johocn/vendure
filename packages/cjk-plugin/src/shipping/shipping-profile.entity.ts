import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import {
    Channel,
    ChannelAware,
    DeepPartial,
    EntityId,
    ID,
    ShippingMethod,
    VendureEntity,
} from '@vendure/core';
import { PickupLocation } from '../pickup/pickup-location.entity';
import { PaymentProfile } from '../payment/payment-profile.entity';

/**
 * 配送方案档案
 *
 * 分为两类：
 * - 全局档案（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户档案（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从档案创建配送方式后，生成的 ShippingMethod 实例与档案完全解耦。
 */
@Entity()
export class ShippingProfile extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<ShippingProfile>) {
        super(input);
    }

    @Column() name: string;

    @Column({ type: 'text' }) description: string;

    @Column() code: string;

    @Column({ default: false })
    isGlobal: boolean;

    @EntityId({ nullable: true })
    ownerChannelId: ID | null;

    @Column({ type: 'int', nullable: true })
    freeShippingThreshold: number | null;

    @Column({ default: false })
    isTenantDefault: boolean;

    @Column({ default: true })
    enabled: boolean;

    @ManyToMany(() => ShippingMethod)
    @JoinTable()
    shippingMethods: ShippingMethod[];

    /**
     * 允许的自提点列表（仅当 shippingMethods 含 store-pickup/pickup-point 时生效）
     * 为空表示不约束，所有自提点可选
     */
    @ManyToMany(() => PickupLocation)
    @JoinTable()
    pickupLocations: PickupLocation[];

    /**
     * 绑定的支付档案（可为空）。
     * 为空时取每箱支付方式白名单回退到租户默认支付档案。
     */
    @ManyToOne(() => PaymentProfile, { onDelete: 'SET NULL', nullable: true })
    paymentProfile?: PaymentProfile;

    @EntityId({ nullable: true })
    paymentProfileId: ID | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}