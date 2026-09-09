import { TaxLine } from '@vendure/common/lib/generated-types';
import { CalculateTaxLinesArgs, TaxLineCalculationStrategy } from '@vendure/core';
export type TaxMode = 'inclusive' | 'zero' | 'exclusive';
/**
 * 租户级税率方式（三态）：
 *  - inclusive（含税价）：录入价=价内含税零售价。走 Vendure 默认单税率，已有 price 即含税价，
 *    结算按税率拆出税额（unitPriceWithTax 退化等于 price），但应付总额不额外加收。
 *  - zero（零税价）：录入价=免税最终价。返回空 TaxLine[]，unitPrice==unitPriceWithTax==净价。
 *  - exclusive（不含税价）：录入价=净价。价税分离：unitPriceWithTax = unitPrice × (1 + rate)。
 * 兼容旧字段：读取 taxMode 缺失时回退旧 taxEnabled（true→inclusive，false→zero），保证存量租户行为不回退。
 */
export declare class ChannelTaxLineCalculationStrategy implements TaxLineCalculationStrategy {
    private readonly defaultStrategy;
    calculate(args: CalculateTaxLinesArgs): TaxLine[];
}
/** 三态解析：taxMode 缺失/非法 → 回退旧 taxEnabled（true→inclusive，false→zero）→ 默认 inclusive */
export declare function resolveTaxMode(customFields: Record<string, unknown>): TaxMode;
