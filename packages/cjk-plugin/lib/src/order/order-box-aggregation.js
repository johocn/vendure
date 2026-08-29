"use strict";
/**
 * 订单「聚合拆合引擎」——纯函数，无任何 I/O、无服务依赖。
 *
 * 输入：分箱结果（每箱含租户渠道 + 可用支付方式 codes）+ 用户所选支付方式；
 * 输出：一组合单「订单组」（每个 orderGroup 即一个独立订单，含若干可合箱）。
 *
 * 聚合规则（设计 spec §2.4 用户定稿）：
 * - 用户选余额（BALANCE_PAYMENT_CODE，全局共享钱包、跨租户跨档案可合单）→ 全部 boxes 合并为 1 个订单；
 * - 用户选非余额方式 → 一律按箱全拆，每个 box 各构成一个独立 orderGroup（每配送档案一单、各自独立支付）；
 *   不做「同租户且各箱白名单都含该方式就合单」的合并（该合并逻辑已废除）。
 *
 * 说明：金额计算在此只做汇总占位，不计算配送；具体配送明细/金额由调用方处理。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BALANCE_PAYMENT_CODE = void 0;
exports.decideAggregation = decideAggregation;
/** 余额支付方式 code（全局共享钱包，Task3 新增 handler） */
exports.BALANCE_PAYMENT_CODE = 'balance-wallet';
/**
 * 聚合拆合引擎（纯函数）。
 *
 * @returns 一组 orderGroup；每个 orderGroup 对应一个独立订单。orderCount = groups.length；
 *          被拆出的单个箱也各计为一个 orderGroup（orderCount 相应 +1）。
 */
function decideAggregation(input) {
    const { boxes, userSelectedPaymentMethod } = input;
    const groups = [];
    if (boxes.length === 0) {
        return { groups: [], totals: { orderCount: 0, boxCount: 0 } };
    }
    // 余额：全局共享钱包，跨租户跨档案全部合为 1 个订单
    if (userSelectedPaymentMethod === exports.BALANCE_PAYMENT_CODE) {
        groups.push({ groupKey: 'balance', boxes: [...boxes], payByBalance: true });
        return { groups, totals: { orderCount: 1, boxCount: boxes.length } };
    }
    // 非余额方式：一律按箱全拆，每箱一个独立订单（每配送档案一单、各自结算）
    for (const box of boxes) {
        groups.push({
            groupKey: `box-${box.tenantChannelId}-${box.boxKey}`,
            boxes: [box],
            payByBalance: false,
        });
    }
    const orderCount = groups.length;
    const boxCount = groups.reduce((sum, g) => sum + g.boxes.length, 0);
    return { groups, totals: { orderCount, boxCount } };
}
//# sourceMappingURL=order-box-aggregation.js.map