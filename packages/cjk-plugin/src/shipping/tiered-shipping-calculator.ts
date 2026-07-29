import { LanguageCode, ShippingCalculator } from '@vendure/core';
import { Order } from '@vendure/core';

/**
 * 阶梯重量 + 区域分组计费计算器
 *
 * 国内快递常用计费模式：
 * - 首重（如1kg）基础费 + 续重（每1kg）追加费
 * - 按收货省份分组，偏远地区（新疆/西藏/青海/内蒙古/宁夏/甘肃）费率更高
 * - 体积重 = 长*宽*高 / 6000，取实际重与体积重中较大值
 * - 满额包邮门槛
 * - 指定省份免邮
 * - 运费封顶（防止大件商品运费过高）
 * - 保价费（按订单金额百分比收取）
 * - 超重附加费（单件超过阈值时加收）
 */
export const tieredWeightShippingCalculator = new ShippingCalculator({
    code: 'tiered-weight-shipping-calculator',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '阶梯重量+区域计费' },
        { languageCode: LanguageCode.en, value: 'Tiered Weight + Region Shipping Calculator' },
    ],
    args: {
        // === 基础计费参数 ===
        firstWeight: {
            type: 'float',
            defaultValue: 1,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '首重(kg)' }],
        },
        firstWeightFee: {
            type: 'int',
            defaultValue: 1000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '首重费用(分)' }],
        },
        additionalWeightUnit: {
            type: 'float',
            defaultValue: 1,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '续重单位(kg)' }],
        },
        additionalWeightFee: {
            type: 'int',
            defaultValue: 500,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '续重费用(分)' }],
        },

        // === 区域附加费 ===
        remoteAreaSurcharge: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '偏远地区附加费(分)' }],
        },
        remoteAreas: {
            type: 'string',
            defaultValue: '新疆,西藏,青海,内蒙古,宁夏,甘肃',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '偏远地区(省份逗号分隔)' }],
        },

        // === 包邮策略 ===
        freeShippingThreshold: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '满额包邮门槛(分, 0=不启用)' }],
        },
        freeShippingAreas: {
            type: 'string',
            defaultValue: '',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '指定省份免邮(逗号分隔, 留空=不启用)' }],
        },

        // === 体积重 ===
        useVolumetricWeight: {
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '启用体积重计算' }],
        },
        volumetricDivisor: {
            type: 'int',
            defaultValue: 6000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '体积重除数' }],
        },

        // === 运费封顶 ===
        maxShippingFee: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '运费封顶(分, 0=不限制)' }],
        },

        // === 保价费 ===
        insuranceFeeRate: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '保价费率(千分比, 0=不收取)' }],
        },
        insuranceMinFee: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '保价最低费用(分)' }],
        },

        // === 超重附加费 ===
        oversizedThreshold: {
            type: 'float',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '超重阈值(kg, 0=不检查)' }],
        },
        oversizedSurcharge: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '超重附加费(分)' }],
        },
    },
    calculate: (ctx, order, args) => {
        // 1. 满额包邮检查
        if (args.freeShippingThreshold > 0 && order.subTotalWithTax >= args.freeShippingThreshold) {
            return {
                price: 0,
                priceIncludesTax: true,
                taxRate: 0,
                metadata: { reason: 'free-shipping-threshold', threshold: args.freeShippingThreshold },
            };
        }

        // 2. 指定省份免邮检查
        if (args.freeShippingAreas) {
            const province = getProvince(order);
            if (province) {
                const freeAreas = String(args.freeShippingAreas).split(',').map(s => s.trim()).filter(Boolean);
                if (freeAreas.some(area => province.includes(area))) {
                    return {
                        price: 0,
                        priceIncludesTax: true,
                        taxRate: 0,
                        metadata: { reason: 'free-shipping-area', province },
                    };
                }
            }
        }

        // 3. 计算订单总重量（含体积重取大值）
        let totalWeight = 0;
        let totalVolumetricWeight = 0;
        let hasOversizedItem = false;
        for (const line of order.lines) {
            const variant = line.productVariant as any;
            const qty = line.quantity;
            const actualWeight = Number(variant?.customFields?.weight) || 0;
            totalWeight += actualWeight * qty;

            // 超重检查（按单品重量）
            if (args.oversizedThreshold > 0 && actualWeight > args.oversizedThreshold) {
                hasOversizedItem = true;
            }

            if (args.useVolumetricWeight) {
                const l = Number(variant?.customFields?.length) || 0;
                const w = Number(variant?.customFields?.width) || 0;
                const h = Number(variant?.customFields?.height) || 0;
                if (l > 0 && w > 0 && h > 0) {
                    totalVolumetricWeight += (l * w * h * qty) / args.volumetricDivisor;
                }
            }
        }

        // 4. 取实际重与体积重较大值
        const chargeableWeight = Math.max(totalWeight, totalVolumetricWeight);

        // 5. 无重量数据时使用首重费用
        if (chargeableWeight <= 0) {
            let fee = args.firstWeightFee;
            fee += getRemoteAreaSurcharge(order, args);
            if (hasOversizedItem) fee += args.oversizedSurcharge;
            fee = applyMaxFee(fee, args.maxShippingFee);
            fee += calculateInsuranceFee(order, args);
            return {
                price: fee,
                priceIncludesTax: true,
                taxRate: 0,
                metadata: {
                    reason: 'no-weight-data',
                    chargeableWeight: 0,
                    baseFee: args.firstWeightFee,
                    surcharge: getRemoteAreaSurcharge(order, args),
                    oversizedSurcharge: hasOversizedItem ? args.oversizedSurcharge : 0,
                    insuranceFee: calculateInsuranceFee(order, args),
                    totalFee: fee,
                },
            };
        }

        // 6. 阶梯计算：首重 + 续重
        let fee = args.firstWeightFee;
        if (chargeableWeight > args.firstWeight) {
            const additionalWeight = chargeableWeight - args.firstWeight;
            const additionalUnits = Math.ceil(additionalWeight / args.additionalWeightUnit);
            fee += additionalUnits * args.additionalWeightFee;
        }

        // 7. 偏远地区附加费
        const remoteSurcharge = getRemoteAreaSurcharge(order, args);
        fee += remoteSurcharge;

        // 8. 超重附加费
        let oversizedFee = 0;
        if (hasOversizedItem) {
            oversizedFee = args.oversizedSurcharge;
            fee += oversizedFee;
        }

        // 9. 运费封顶（在保价费之前应用）
        const feeBeforeCap = fee;
        fee = applyMaxFee(fee, args.maxShippingFee);

        // 10. 保价费
        const insuranceFee = calculateInsuranceFee(order, args);
        fee += insuranceFee;

        return {
            price: fee,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: {
                reason: 'weight-based',
                actualWeight: Math.round(totalWeight * 1000) / 1000,
                volumetricWeight: args.useVolumetricWeight ? Math.round(totalVolumetricWeight * 1000) / 1000 : 0,
                chargeableWeight: Math.round(chargeableWeight * 1000) / 1000,
                baseFee: args.firstWeightFee,
                additionalFee: feeBeforeCap - args.firstWeightFee - remoteSurcharge - oversizedFee,
                remoteSurcharge,
                oversizedSurcharge: oversizedFee,
                capped: args.maxShippingFee > 0 && feeBeforeCap > args.maxShippingFee,
                capApplied: args.maxShippingFee > 0 && feeBeforeCap > args.maxShippingFee ? args.maxShippingFee - feeBeforeCap : 0,
                insuranceFee,
                totalFee: fee,
            },
        };
    },
});

/**
 * 件数阶梯计费计算器
 * 国内部分快递按件计费：首件 X 元 + 续件 Y 元
 * 支持：满额包邮、满件包邮、指定省份免邮、运费封顶
 */
export const tieredQuantityShippingCalculator = new ShippingCalculator({
    code: 'tiered-quantity-shipping-calculator',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '阶梯件数计费' },
        { languageCode: LanguageCode.en, value: 'Tiered Quantity Shipping Calculator' },
    ],
    args: {
        firstItemFee: {
            type: 'int',
            defaultValue: 800,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '首件费用(分)' }],
        },
        additionalItemFee: {
            type: 'int',
            defaultValue: 200,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '续件费用(分)' }],
        },
        freeShippingThreshold: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '满额包邮门槛(分, 0=不启用)' }],
        },
        freeShippingQuantity: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '满件包邮(件, 0=不启用)' }],
        },
        freeShippingAreas: {
            type: 'string',
            defaultValue: '',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '指定省份免邮(逗号分隔, 留空=不启用)' }],
        },
        maxShippingFee: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '运费封顶(分, 0=不限制)' }],
        },
    },
    calculate: (ctx, order, args) => {
        const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);

        // 1. 满额包邮
        if (args.freeShippingThreshold > 0 && order.subTotalWithTax >= args.freeShippingThreshold) {
            return {
                price: 0,
                priceIncludesTax: true,
                taxRate: 0,
                metadata: { reason: 'free-shipping-threshold', threshold: args.freeShippingThreshold },
            };
        }

        // 2. 满件包邮
        if (args.freeShippingQuantity > 0 && totalQuantity >= args.freeShippingQuantity) {
            return {
                price: 0,
                priceIncludesTax: true,
                taxRate: 0,
                metadata: { reason: 'free-shipping-quantity', quantity: totalQuantity, threshold: args.freeShippingQuantity },
            };
        }

        // 3. 指定省份免邮
        if (args.freeShippingAreas) {
            const province = getProvince(order);
            if (province) {
                const freeAreas = String(args.freeShippingAreas).split(',').map(s => s.trim()).filter(Boolean);
                if (freeAreas.some(area => province.includes(area))) {
                    return {
                        price: 0,
                        priceIncludesTax: true,
                        taxRate: 0,
                        metadata: { reason: 'free-shipping-area', province },
                    };
                }
            }
        }

        // 4. 计算运费
        let fee = args.firstItemFee;
        if (totalQuantity > 1) {
            fee += (totalQuantity - 1) * args.additionalItemFee;
        }

        // 5. 运费封顶
        const feeBeforeCap = fee;
        fee = applyMaxFee(fee, args.maxShippingFee);

        return {
            price: fee,
            priceIncludesTax: true,
            taxRate: 0,
            metadata: {
                reason: 'quantity-based',
                totalQuantity,
                firstItemFee: args.firstItemFee,
                additionalItemFee: args.additionalItemFee,
                capped: args.maxShippingFee > 0 && feeBeforeCap > args.maxShippingFee,
                totalFee: fee,
            },
        };
    },
});

// ===== 工具函数 =====

function getProvince(order: Order): string {
    const shippingAddress = (order as any).shippingAddress;
    if (!shippingAddress) return '';
    return shippingAddress.province || '';
}

function getRemoteAreaSurcharge(order: Order, args: any): number {
    const province = getProvince(order);
    if (!province || !args.remoteAreas) return 0;
    const remoteList = String(args.remoteAreas).split(',').map(s => s.trim());
    const isRemote = remoteList.some(area => province.includes(area));
    return isRemote ? args.remoteAreaSurcharge : 0;
}

function applyMaxFee(fee: number, maxFee: number): number {
    if (maxFee > 0 && fee > maxFee) return maxFee;
    return fee;
}

function calculateInsuranceFee(order: Order, args: any): number {
    if (!args.insuranceFeeRate || args.insuranceFeeRate <= 0) return 0;
    const orderAmount = order.subTotalWithTax;
    let fee = Math.ceil((orderAmount * args.insuranceFeeRate) / 1000);
    if (args.insuranceMinFee > 0 && fee < args.insuranceMinFee) {
        fee = args.insuranceMinFee;
    }
    return fee;
}
