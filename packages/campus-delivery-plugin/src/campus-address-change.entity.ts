import { Column, Entity } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/**
 * 改址台账：顾客下单后修改配送地址产生的运费差额（多退少补）。
 * 差额不阻塞改址，运营在后台统一退款/补收后标记结清。
 */
@Entity()
export class CampusAddressChange extends VendureEntity {
    @Column('int') channelId: ID;
    @Column('int') orderId: ID;
    @Column() orderCode: string;
    @Column('int', { nullable: true }) customerId: ID | null;

    @Column() fromZone: string;
    @Column() fromBuilding: string;
    @Column({ type: 'varchar', nullable: true }) fromDetail: string | null;

    @Column() toZone: string;
    @Column() toBuilding: string;
    @Column({ type: 'varchar', nullable: true }) toDetail: string | null;

    @Column('int') oldFee: number; // 分
    @Column('int') newFee: number; // 分
    @Column('int') diff: number; // 正=待收（顾客欠），负=待退

    /** pending | settled | waived */
    @Column({ default: 'pending' }) status: string;
    @Column({ nullable: true, type: 'timestamp' }) settledAt: Date | null;
    @Column('int', { nullable: true }) settledBy: ID | null;
    /** refund=已退顾客 | collect=已补收 | waive=免收 */
    @Column({ type: 'varchar', nullable: true }) settleAction: string | null;

    constructor(input?: DeepPartial<CampusAddressChange>) {
        super(input);
    }
}
