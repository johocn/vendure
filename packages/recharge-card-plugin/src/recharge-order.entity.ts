import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToOne } from 'typeorm';

export type RechargeOrderStatus = 'pending' | 'paid' | 'cancelled';

@Entity()
export class RechargeOrder extends VendureEntity {
    constructor(input?: DeepPartial<RechargeOrder>) {
        super(input);
    }

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'int' })
    amount: number;

    // 显式 varchar 防 Object 反射（阶段12/27 铁律）
    @Column({ type: 'varchar' })
    status: RechargeOrderStatus;

    // 预留网关口（alipay/wechat）；现无网关时留空
    @Column({ type: 'varchar', nullable: true })
    paymentMethod: string | null;

    // 网关商户单号 out_trade_no（幂等核对）
    @Column({ type: 'varchar', nullable: true })
    externalRef: string | null;

    // 不写死字段类型，交由驱动自动映射（postgres->timestamp，sqlite->datetime）
    // 用可选 `?`（非 `| null`）以令反射为 Date，TypeORM 才能推断列类型
    @Column({ nullable: true })
    paidAt?: Date;

    @Column({ type: 'text', nullable: true })
    remark: string | null;

    @ManyToOne(() => Channel, { eager: false })
    channel: Channel;

    @Column()
    channelId: number;
}