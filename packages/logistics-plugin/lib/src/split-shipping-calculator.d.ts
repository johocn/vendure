import { ShippingCalculator } from '@vendure/core';
/**
 * 每包裹独立计费：读取订单拆分明细 stockLocationsJson，
 * 逐包按 channel 级 packageShippingRule 计费后合计为一笔运费。
 * 计费结果明细写入 Order.packageShippingJson，供前端「运费明细」区块展示。
 */
export declare const splitShippingCalculator: ShippingCalculator<{}>;
