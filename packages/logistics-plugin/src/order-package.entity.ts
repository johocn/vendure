import { Column, Entity } from 'typeorm';
import { DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';

/** 包裹状态：待发货 → 已发货 → 已送达；配送取消 → 已取消（终态） */
export type OrderPackageStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

/** 拆单包裹（追溯底座 + 状态机）：一个包 = 一个出货仓的履约单元，落库拆单确认时的 SplitPackage */
@Entity()
export class OrderPackage extends VendureEntity {
    constructor(input?: DeepPartial<OrderPackage>) {
        super(input);
    }

    /** 包号，沿用现有命名 P1/P2 */
    @Column() code: string;
    /** 所属订单 */
    @EntityId() orderId: ID;
    /** 出货仓（一个包 = 一个出货仓的履约单元） */
    @EntityId() stockLocationId: ID;
    /** 包内行明细 [{ orderLineId, quantity }]（结构复用 SplitLine） */
    @Column({ type: 'text', nullable: true }) linesJson: string | null;
    /** 本包运费（分）：确认时=估算值，发货后回填实际值 */
    @Column({ type: 'int', nullable: true }) shippingFee: number | null;
    /** 配送模式 'self' | 'city'（自有司机 / 同城配送） */
    @Column({ default: 'self' }) deliveryMode: string;
    /** 关联发货记录（发货回填） */
    @EntityId({ nullable: true }) fulfillmentId: ID | null;
    /** 关联配送单 DeliveryOrder（同城配送回填） */
    @EntityId({ nullable: true }) deliveryOrderId: ID | null;
    /** 包裹状态：待发货/已发货/已送达/配送取消 */
    @Column({ default: 'pending' }) status: OrderPackageStatus;
    /** 发货时间 */
    @Column({ type: 'timestamp', nullable: true }) shippedAt: Date | null;
    /** 送达时间 */
    @Column({ type: 'timestamp', nullable: true }) deliveredAt: Date | null;
    /** 取消时间 */
    @Column({ type: 'timestamp', nullable: true }) cancelledAt: Date | null;
}
