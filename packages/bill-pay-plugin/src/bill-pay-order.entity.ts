import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { BillPayStatus } from './types';

/**
 * 代买单委托单：独立单据，不生成 Vendure Order（不进既有订单列表/流程）。
 * 参照 coupon_sale_order 骨架扩展（设计文档 §2.1）。金额单位：分。
 */
@Entity('bill_pay_order')
export class BillPayOrder extends VendureEntity {
    constructor(input?: DeepPartial<BillPayOrder>) {
        super(input);
    }

    /** 业务单号 BP-<id>，全局唯一（亦作微信 out_trade_no，回调按 BP- 前缀路由） */
    @Index({ unique: true })
    @Column({ type: 'varchar', nullable: true })
    code: string | null;

    /** 下单客户 */
    @Index()
    @Column({ type: 'int' })
    customerId: number;

    /** 商家名称（P0 文本 + 历史联想） */
    @Column({ type: 'varchar' })
    merchantName: string;

    /** 关联商户 id（merchant-plugin 的 merchant；两插件无外键，下单时应用层校验） */
    @Index()
    @Column({ type: 'int', nullable: true })
    merchantId: number | null;

    /** 预计账单金额 */
    @Column({ type: 'int' })
    expectedAmount: number;

    /** 平台报价 = 客户应付 */
    @Column({ type: 'int', nullable: true })
    quoteAmount: number | null;

    /** 管家实际代付金额（凭证回传时填写，商家账单原价口径） */
    @Column({ type: 'int', nullable: true })
    actualAmount: number | null;

    /** 优惠明细 JSON：[{rule, label, amount}] */
    @Column({ type: 'text', nullable: true })
    discountDetail: string | null;

    /** 下单抵扣所用券码（null = 未用券）；与 couponDiscount 成对落库，便于对账追溯 */
    @Column({ type: 'varchar', length: 64, nullable: true })
    couponCode: string | null;

    /** 券实际抵扣额（分）；明细仍在 discountDetail，单独成列便于统计 */
    @Column({ type: 'int', nullable: true })
    couponDiscount: number | null;

    @Column({ type: 'varchar' })
    status: BillPayStatus;

    /** 客户备注（留言卡/包间等） */
    @Column({ type: 'text', nullable: true })
    remark: string | null;

    /** 管家报价说明（人工改价时必填） */
    @Column({ type: 'text', nullable: true })
    quoteNote: string | null;

    /** 报价有效期（超时惰性失效回 PENDING_QUOTE） */
    @Column({ type: Date, nullable: true })
    quoteExpireAt: Date | null;

    /** 代付凭证（支付截图/小票 URL，受控访问） */
    @Column({ type: 'varchar', nullable: true })
    proofUrl: string | null;

    /** 外部支付单号 out_trade_no（= code，幂等核对） */
    @Column({ type: 'varchar', nullable: true })
    payRef: string | null;

    /** wechatpay | balance */
    @Column({ type: 'varchar', nullable: true })
    paymentMethod: string | null;

    /** 接单管家/操作人（web-admin 用户 id） */
    @Column({ type: 'int', nullable: true })
    operatorId: number | null;

    /** 结算台账行引用（bill_pay_settlement.id） */
    @Column({ type: 'int', nullable: true })
    settleLedgerId: number | null;

    @Column({ type: Date, nullable: true })
    paidAt: Date | null;

    @Column({ type: Date, nullable: true })
    completedAt: Date | null;

    @Column({ type: Date, nullable: true })
    settledAt: Date | null;

    @Column({ type: Date, nullable: true })
    refundedAt: Date | null;

    /** 超容忍阈值时的备注说明 */
    @Column({ type: 'text', nullable: true })
    completeNote: string | null;

    @Index()
    @Column({ type: 'int' })
    channelId: number;
}
