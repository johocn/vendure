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
/** 余额支付方式 code（全局共享钱包，Task3 新增 handler） */
export declare const BALANCE_PAYMENT_CODE = "balance-wallet";
/** 单箱聚合入参。由调用方在调引擎前填充每箱支付方式白名单（Box 对象本身可能不含）。
 * 注意：不硬依赖 OrderBox 类型，字段按需提供即可。 */
export interface AggregationBox {
    /** 箱的唯一稳定标识 */
    boxKey: string;
    /** 生效配送档案 id */
    profileId: string;
    /** 该箱所在租户渠道 id */
    tenantChannelId: string;
    /** 该箱可用支付方式 code 集合（来自其配送档案所绑定的支付档案） */
    availablePaymentMethodCodes: string[];
}
export interface AggregationInput {
    boxes: AggregationBox[];
    /** 用户所选支付方式 code */
    userSelectedPaymentMethod: string;
}
/** 一组可合单到同一订单的箱 */
export interface OrderGroup {
    /** 组稳定键：'balance' | `tenant-${tenantChannelId}` | 拆出单箱 `box-${tenantChannelId}-${boxKey}` */
    groupKey: string;
    boxes: AggregationBox[];
    /** 该组是否走余额（全局共享钱包）支付 */
    payByBalance: boolean;
}
export interface AggregationResult {
    groups: OrderGroup[];
    totals: {
        orderCount: number;
        boxCount: number;
    };
}
/**
 * 聚合拆合引擎（纯函数）。
 *
 * @returns 一组 orderGroup；每个 orderGroup 对应一个独立订单。orderCount = groups.length；
 *          被拆出的单个箱也各计为一个 orderGroup（orderCount 相应 +1）。
 */
export declare function decideAggregation(input: AggregationInput): AggregationResult;
