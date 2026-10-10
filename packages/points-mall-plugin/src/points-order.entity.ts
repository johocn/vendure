import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 积分订单。状态机：
 *  纯积分+virtual: completed（扣分即完成）
 *  纯积分+physical: pending_ship → shipped → completed
 *  混合价: pending_payment(已扣分+已建支付单) → 支付回调后 → pending_ship/completed
 *  cancelled: 未支付取消（退积分+回补库存）
 */
@Entity()
@Index(['customerId', 'channelId'])
@Index(['channelId', 'status'])
export class PointsOrder extends VendureEntity {
    constructor(input?: DeepPartial<PointsOrder>) {
        super(input);
    }

    @Column({ unique: true })
    code: string; // PO-<id>，保存后回写

    @Column()
    customerId: number;

    @Column()
    pointsProductId: number;

    /** 商品快照：{ productId, variantId, name, image, spec } */
    @Column({ type: 'simple-json' })
    productSnapshot: Record<string, any>;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'int' })
    pointsTotal: number; // pointsPrice * quantity

    @Column({ type: 'int', default: 0 })
    cashTotal: number; // cashPrice * quantity（分）

    @Column()
    deliveryType: string;

    /** 实物必填：{ name, phone, province, city, district, detail } */
    @Column({ type: 'simple-json', nullable: true })
    addressSnapshot: Record<string, any> | null;

    @Column()
    status: string;

    @Column({ type: 'varchar', nullable: true })
    trackingNo: string | null;

    @Column({ type: 'datetime', nullable: true })
    paidAt: Date | null;

    @Column({ type: 'datetime', nullable: true })
    shippedAt: Date | null;

    @Column({ type: 'datetime', nullable: true })
    completedAt: Date | null;

    @Column()
    channelId: number;
}
