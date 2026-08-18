import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';

/**
 * 行级供销存账本：订单 / 进销存单据 / 售后 三者之间的统一关联中间表。
 *
 * 任何真实 onHand 变动（发货扣减、退货入库、入库单、出库单、调拨收发、盘点差异、手工调账）
 * 都通过 `inventory.service.adjustStockForLocation` 在**同一事务**内写一条流水，
 * 沿 bizCode（orderCode / afterSalesCode / RKT.. / DBT..）即可追溯完整链路。
 */
@Entity()
export class OrderStockLedger extends VendureEntity {
    constructor(input?: DeepPartial<OrderStockLedger>) {
        super(input);
    }

    /** 账本单号 YSZ + 时间戳 */
    @Column() code: string;

    @EntityId() productVariantId: ID;

    /** 发生仓/门店 */
    @EntityId() stockLocationId: ID;

    /** 业务类型 */
    @Column() bizType: string;

    /** 业务单号（orderCode / afterSalesCode / RKT.. / DBT.. / PDT..） */
    @Column({ nullable: true }) bizCode: string;

    /** 关联订单行（bizType=order/afterSales 时） */
    @Column({ nullable: true }) orderLineId: number | null;

    /** 方向：in=入库/回补，out=扣减/发出 */
    @Column() direction: 'in' | 'out';

    /** 数量（正数） */
    @Column() quantity: number;

    /** 变动前后 onHand 快照（对账用） */
    @Column({ nullable: true }) beforeOnHand: number;
    @Column({ nullable: true }) afterOnHand: number;

    /** 跨仓关联（调拨 源仓↔目标仓 互指；null 表示无） */
    @Column({ nullable: true }) otherLocationId: number | null;

    /** 业务说明（如 order#xxx:fulfill-sell、afterSales#xxx:return-restock） */
    @Column({ nullable: true }) reason: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}