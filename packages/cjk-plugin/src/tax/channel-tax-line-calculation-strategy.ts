import { TaxLine } from '@vendure/common/lib/generated-types';
import {
    CalculateTaxLinesArgs,
    DefaultTaxLineCalculationStrategy,
    TaxLineCalculationStrategy,
} from '@vendure/core';

/**
 * 租户级税率开关：当 Channel.customFields.taxEnabled === false 时，订单行按「零税率」结算，
 * 即商品/购物车结算使用不含税的净价（后台录入价），与前端展示口径一致。
 * 默认 true（含税），回退到 Vendure 默认单税率计算，确保存量租户行为不变。
 *
 * 实现原理：OrderLine.taxRate = sum(taxLines.taxRate)。taxEnabled=false 时返回空 TaxLine[]，
 * 使 line 的 taxRate=0，unitPriceWithTax 退化等于净价 unitPrice，订单总额即结算价。
 */
export class ChannelTaxLineCalculationStrategy implements TaxLineCalculationStrategy {
    private readonly defaultStrategy = new DefaultTaxLineCalculationStrategy();

    calculate(args: CalculateTaxLinesArgs): TaxLine[] {
        const channel = (args.ctx as any)?.channel as any | undefined;
        const taxEnabled = channel?.customFields?.taxEnabled ?? true;
        if (taxEnabled === false) {
            return [];
        }
        return this.defaultStrategy.calculate(args);
    }
}