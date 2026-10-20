import { CouponSettlementOrder } from './coupon-settlement-order.entity';
/**
 * 分账适配器（买单券资金流 T3）：
 * 结算服务只依赖本接口，微信实联实现待合规结论（Q3.1/Q3.2）+ 灰度后再接入
 * （风险铁律①：stub → 实联必须持书面结论，单渠道小额先行）。
 * 幂等约定：submitSplit 的 idempotencyKey = 结算单号 settlementNo（唯一），
 * 网关侧必须以 out_request_no 幂等，重试不会重复分账。
 */
export interface SplitSubmitResult {
    accepted: boolean;
    receiptNo?: string;
    error?: string;
}
export interface SplitReceiptResult {
    state: 'PROCESSING' | 'FINISHED' | 'FAILED';
    error?: string;
}
export interface SettlementAdapter {
    /** 模式标识（烧录进结算单 splitMode 快照） */
    mode: string;
    /** 提交分账（幂等键 = 结算单号） */
    submitSplit(order: CouponSettlementOrder, idempotencyKey: string): Promise<SplitSubmitResult>;
    /** 查询分账回执 */
    queryReceipt(receiptNo: string): Promise<SplitReceiptResult>;
    /** 追偿分账（T8 退款联动预留） */
    refundSplit(order: CouponSettlementOrder, reason?: string): Promise<SplitSubmitResult>;
}
/** 分账模式只读解析（T9 进件状态页用）：不实例化适配器、wechat 未持合规结论也不抛错，仅返回配置态 */
export declare function resolveSplitMode(): 'stub' | 'wechat' | 'unknown';
/**
 * 按环境变量 COUPON_SPLIT_MODE 解析适配器：
 * - 'stub'（默认）：stub 模拟
 * - 'wechat'：微信分账实联 —— P0 未持合规书面结论前明确拒绝（宁可结算单留在重试队列，
 *   也不静默回落 stub 造成「假分账成功」的账实不符）。
 */
export declare function resolveSettlementAdapter(): SettlementAdapter;
/** 佣金/净付额计算（纯函数，供结算登记与单测共用）：费率万分比，佣金额向下取整分 */
export declare function computeSettlementAmounts(faceAmount: number, commissionRateBp: number): {
    commissionAmount: number;
    netAmount: number;
};
/** 结算单号（确定性生成；customerCouponId 唯一 ⇒ 单号唯一） */
export declare function buildSettlementNo(channelId: number, customerCouponId: number): string;
