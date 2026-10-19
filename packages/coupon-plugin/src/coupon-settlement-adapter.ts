import { Logger } from '@vendure/core';

import { loggerCtx } from './constants';
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

/**
 * stub 适配器：本地闭环模拟，受理即返回确定性回执号、回执即 FINISHED。
 * 不产生任何真实资金动作；生产可开（结算单留痕、状态机真实流转），便于对账演练。
 */
class StubSettlementAdapter implements SettlementAdapter {
    readonly mode = 'stub';

    async submitSplit(order: CouponSettlementOrder, idempotencyKey: string): Promise<SplitSubmitResult> {
        return { accepted: true, receiptNo: `STUB-${idempotencyKey}` };
    }

    async queryReceipt(receiptNo: string): Promise<SplitReceiptResult> {
        return { state: 'FINISHED' };
    }

    async refundSplit(order: CouponSettlementOrder, reason?: string): Promise<SplitSubmitResult> {
        return { accepted: true, receiptNo: `STUB-REV-${order.settlementNo}` };
    }
}

/**
 * 按环境变量 COUPON_SPLIT_MODE 解析适配器：
 * - 'stub'（默认）：stub 模拟
 * - 'wechat'：微信分账实联 —— P0 未持合规书面结论前明确拒绝（宁可结算单留在重试队列，
 *   也不静默回落 stub 造成「假分账成功」的账实不符）。
 */
export function resolveSettlementAdapter(): SettlementAdapter {
    const mode = (process.env.COUPON_SPLIT_MODE ?? 'stub').trim().toLowerCase();
    if (mode === 'wechat') {
        throw new Error(
            'COUPON_SPLIT_MODE=wechat requires written compliance approval (Q3.1/Q3.2) and the wechat split implementation; keep SPLIT_MODE=stub for now',
        );
    }
    if (mode !== 'stub') {
        Logger.warn(`Unknown COUPON_SPLIT_MODE=${mode}, falling back to stub`, loggerCtx);
    }
    return new StubSettlementAdapter();
}

/** 佣金/净付额计算（纯函数，供结算登记与单测共用）：费率万分比，佣金额向下取整分 */
export function computeSettlementAmounts(
    faceAmount: number,
    commissionRateBp: number,
): { commissionAmount: number; netAmount: number } {
    const face = Math.max(0, Math.floor(Number(faceAmount) || 0));
    const bp = Math.max(0, Math.floor(Number(commissionRateBp) || 0));
    const commissionAmount = Math.floor((face * bp) / 10000);
    return { commissionAmount, netAmount: face - commissionAmount };
}

/** 结算单号（确定性生成；customerCouponId 唯一 ⇒ 单号唯一） */
export function buildSettlementNo(channelId: number, customerCouponId: number): string {
    return `CSTL-${channelId}-${customerCouponId}`;
}
