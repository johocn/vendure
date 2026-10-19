import { DeepPartial, VendureEntity } from '@vendure/core';
import { CouponSettlementStatus } from './types';
/**
 * 券结算单（买单券资金流 T1，对标设计文档「服务商分账模式」）：
 * 用户购买券（资金冻结于微信待分账）→ 到店核销 → T+1 生成/提交结算单 → 分账给特约商户。
 * 售出即结算 = 二清红线，故结算单必须以「核销」为唯一前提（redeemRef 关联核销凭证）。
 * 金额单位：分；佣金费率单位：万分比（bp，500 = 5%）。
 */
export declare class CouponSettlementOrder extends VendureEntity {
    constructor(input?: DeepPartial<CouponSettlementOrder>);
    /** 结算归属租户渠道 id */
    channelId: number;
    /** 券单 id（资金来源 CouponSaleOrder.id；历史数据/异常兜底时可能为 null） */
    saleOrderId: number | null;
    /** 被核销券实例 id（customer_coupon.id，唯一） */
    customerCouponId: number;
    /** 券模板 id 快照 */
    templateId: number | null;
    /** 核销凭证（幂等溯源）：BILL:{inStoreBillId} */
    redeemRef: string;
    /** 到店买单流水 id（P0 结算登记仅来自到店核销；线上核销折算口径后续任务） */
    inStoreBillId: number | null;
    /** 面额折算额（分）= 核销优惠额（商家应得基数） */
    faceAmount: number;
    /** 佣金费率快照（万分比，出单时烧录，费率后续调整不影响已出结算单） */
    commissionRateBp: number;
    /** 佣金额（分）= faceAmount * commissionRateBp / 10000 */
    commissionAmount: number;
    /** 净付额（分）= faceAmount - commissionAmount（分账给商户的金额） */
    netAmount: number;
    /** 状态机：PENDING → SETTLED → PAID_OUT；REVERSED（追偿）/CANCELLED（核销回退） */
    status: CouponSettlementStatus;
    /** 结算单号（分账幂等键，CSTL-{channelId}-{customerCouponId}，唯一） */
    settlementNo: string;
    /** 分账模式快照（提交时烧录）：stub | wechat */
    splitMode: string | null;
    /** 分账回执号（网关受理后返回） */
    splitReceiptNo: string | null;
    /** 分账提交重试次数（重试队列） */
    attempts: number;
    /** 最近一次提交/回执错误（重试队列排查用） */
    lastError: string | null;
    /** 分账受理时间（禁用 `| null` 联合类型：lib 编译后 design:type 变 Object，TypeORM 无法推断列型） */
    settledAt?: Date;
    /** 分账完成（回执 FINISHED）时间 */
    paidOutAt?: Date;
    /** 追偿完成时间（T8 退款联动） */
    reversedAt?: Date;
    /** 备注 */
    remark: string | null;
}
