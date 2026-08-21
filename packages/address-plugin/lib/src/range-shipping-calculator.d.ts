import { ShippingCalculator } from '@vendure/core';
/**
 * 按店运费计价：读订单行 → 商品所属 ShopId 反查，按店聚合小计，
 * 每店读取 DeliveryRange.baseFee / freeThreshold：小计 ≥ freeThreshold 即包邮(0)，否则收 baseFee。
 * 合计为订单运费；明细写入 metadata.shops 供前端「运费明细」展示。
 */
export declare const rangeShippingCalculator: ShippingCalculator<{}>;
