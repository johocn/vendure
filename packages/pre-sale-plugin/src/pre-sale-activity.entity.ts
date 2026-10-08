import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export type PreSaleMode = 'deposit' | 'full';
export type PreSaleStatus = 'upcoming' | 'active' | 'delivered' | 'ended';

/**
 * 预售活动。
 * 支持三种模式：
 * - full（全款预售）：预售期一次性收全款 → 到货后发货
 * - deposit（定金预售）：先收定金 → 到货/尾款窗口开启后收尾款 → 补齐后发货
 * - 预售价格分档：presalePrice < 原价，结算期 Promotion 动态打折到预售价
 */
@Entity()
export class PreSaleActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PreSaleActivity>) {
        super(input);
    }

    @Column('varchar')
    name: string;

    /** deposit（定金）/ full（全款） */
    @Column('varchar')
    mode: PreSaleMode;

    @Column()
    startAt: Date;

    @Column()
    endAt: Date;

    /** 到货/开售时间（尾款开启或全款发货 latch） */
    @Column({ nullable: true })
    releaseAt?: Date;

    /** 尾款支付窗口开启时间（deposit 模式） */
    @Column({ nullable: true })
    tailStartAt?: Date;

    /** 尾款支付窗口截止时间（deposit 模式） */
    @Column({ nullable: true })
    tailEndAt?: Date;

    /** 预售价（分）；<=0 表示无价格分档，用原价 */
    @Column({ type: 'int' })
    presalePrice: number;

    /** 定金金额（分）；deposit 模式用，<=0 时落到全款语义 */
    @Column({ type: 'int' })
    depositAmount: number;

    @Column({ type: 'int' })
    totalStock: number;

    @Column({ type: 'int', default: 0 })
    soldCount: number;

    @Column({ type: 'int', default: 1 })
    limitPerUser: number;

    @Column({ type: 'int' })
    productId: number;

    @Column({ type: 'int' })
    variantId: number;

    @Column({ type: 'int' })
    channelId: number;

    /** 定金性质：legal_deposit（法律定金，有罚则）/ earnest（订金，原则上可退） */
    @Column('varchar', { default: 'legal_deposit' })
    depositKind: 'legal_deposit' | 'earnest';

    /** 尾款触发方式：date（到点自动）/ group_buy（成团解锁）/ manual（管理员开启） */
    @Column('varchar', { default: 'date' })
    tailTriggerType: 'date' | 'group_buy' | 'manual';

    /** 团购活动 id（tailTriggerType=group_buy 时必填） */
    @Column({ type: 'int', nullable: true })
    groupBuyActivityId?: number;

    /** 尾款支付窗口时长（小时，展示/协议用） */
    @Column({ type: 'int', nullable: true })
    tailWindowHours?: number;

    /** 期次宽限小时数（逾期判定） */
    @Column({ type: 'int', default: 72 })
    graceHours: number;

    /** 订金退款策略（depositKind=earnest 时生效） */
    @Column('simple-json', { nullable: true })
    earnestRefundPolicy?: { onTimeout: 'full' | 'partial'; partialRate?: number } | null;

    /** 发货承诺时间（卖家违约判定基准） */
    @Column({ type: 'datetime', nullable: true })
    shipDeadlineAt?: Date;

    /** 协议版本快照（下单时写入期次实例，改配置不影响已生成订单） */
    @Column('varchar', { default: 'v1' })
    agreementVersion: string;

    @Column('varchar', { default: 'upcoming' })
    status: PreSaleStatus;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}