import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import {
    Channel,
    ChannelAware,
    DeepPartial,
    EntityId,
    ID,
    PaymentMethod,
    VendureEntity,
} from '@vendure/core';

/**
 * 支付方案档案
 *
 * 分为两类：
 * - 全局档案（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户档案（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从档案创建支付方式后，生成的 PaymentMethod 实例与档案完全解耦。
 */
@Entity()
export class PaymentProfile extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PaymentProfile>) {
        super(input);
    }

    @Column() name: string;

    @Column({ type: 'text' }) description: string;

    @Column() code: string;

    @Column({ default: false })
    isGlobal: boolean;

    @EntityId({ nullable: true })
    ownerChannelId: ID | null;

    @Column({ type: 'simple-json', nullable: true })
    installmentOptions: Record<string, any> | null;

    @ManyToMany(() => PaymentMethod)
    @JoinTable()
    paymentMethods: PaymentMethod[];

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}