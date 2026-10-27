/**
 * 配送费阶梯计价（P3-4，2026-10-27）：按订单商品金额分档改变分区运费基价。
 * 命中规则：取「门槛 <= 商品金额」的最高档 fee 作为基价；一档都不满足时回退分区固定运费。
 * 与满 X 元免配送费的关系：满免优先（达标直接 0），阶梯只作用于未满免的订单。
 * 纯函数，便于单测；后台写入走 normalize（严格），结算/展示走 parse（宽松，坏配置不阻断下单）。
 */
export interface DeliveryFeeTier {
    /** 订单商品金额门槛（分，含） */
    minAmount: number;
    /** 该档配送费基价（分） */
    fee: number;
}
/** 档位上限：超过 10 档配置不可维护，直接拒绝 */
export declare const MAX_DELIVERY_FEE_TIERS = 10;
/** 后台写入：严格校验，任何非法项/重复门槛直接抛错（错误文案直接回显给运营） */
export declare function normalizeDeliveryFeeTiers(raw: unknown): DeliveryFeeTier[] | null;
/** 结算/展示：宽松解析（脏项丢弃、门槛去重、超 10 档截断），永不抛错 */
export declare function parseDeliveryFeeTiers(raw: unknown): DeliveryFeeTier[];
/** 取命中档位：tiers 需已按 minAmount 升序；返回 null 表示未达最低档，调用方回退分区固定运费 */
export declare function resolveDeliveryFeeTier(tiers: DeliveryFeeTier[], goods: number): DeliveryFeeTier | null;
