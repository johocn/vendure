import { TaxLine } from '@vendure/common/lib/generated-types';
import {
    CalculateTaxLinesArgs,
    DefaultTaxLineCalculationStrategy,
    TaxLineCalculationStrategy,
} from '@vendure/core';

export type TaxMode = 'inclusive' | 'zero' | 'exclusive';

/**
 * 租户级税率方式（三态）：
 *  - inclusive（含税价）：录入价=价内含税零售价。走 Vendure 默认单税率，已有 price 即含税价，
 *    结算按税率拆出税额（unitPriceWithTax 退化等于 price），但应付总额不额外加收。
 *  - zero（零税价）：录入价=免税最终价。返回空 TaxLine[]，unitPrice==unitPriceWithTax==净价。
 *  - exclusive（不含税价）：录入价=净价。价税分离：unitPriceWithTax = unitPrice × (1 + rate)。
 * 兼容旧字段：读取 taxMode 缺失时回退旧 taxEnabled（true→inclusive，false→zero），保证存量租户行为不回退。
 */
export class ChannelTaxLineCalculationStrategy implements TaxLineCalculationStrategy {
    private readonly defaultStrategy = new DefaultTaxLineCalculationStrategy();

    calculate(args: CalculateTaxLinesArgs): TaxLine[] {
        const channel = (args.ctx as any)?.channel as any | undefined;
        const cf = channel?.customFields ?? {};
        const mode = resolveTaxMode(cf);
        if (mode === 'zero') {
            return [];
        }
        // inclusive / exclusive 都交给 Vendure 单税率逻辑：
        //  - inclusive 渠道 pricesIncludeTax=true → 默认拆税，价内；
        //  - exclusive 渠道 pricesIncludeTax=false → 默认对净价加税，价税分离。
        return this.defaultStrategy.calculate(args);
    }
}

/** 三态解析：taxMode 缺失/非法 → 回退旧 taxEnabled（true→inclusive，false→zero）→ 默认 inclusive */
export function resolveTaxMode(customFields: Record<string, unknown>): TaxMode {
    const mode = customFields?.taxMode;
    if (mode === 'inclusive' || mode === 'zero' || mode === 'exclusive') return mode as TaxMode;
    const legacy = customFields?.taxEnabled;
    if (legacy === false) return 'zero';
    return 'inclusive';
}