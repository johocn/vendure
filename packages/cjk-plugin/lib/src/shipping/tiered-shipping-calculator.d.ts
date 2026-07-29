import { LanguageCode, ShippingCalculator } from '@vendure/core';
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
export declare const tieredWeightShippingCalculator: ShippingCalculator<{
    firstWeight: {
        type: "float";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    firstWeightFee: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    additionalWeightUnit: {
        type: "float";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    additionalWeightFee: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    remoteAreaSurcharge: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    remoteAreas: {
        type: "string";
        defaultValue: string;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    freeShippingThreshold: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    freeShippingAreas: {
        type: "string";
        defaultValue: string;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    useVolumetricWeight: {
        type: "boolean";
        defaultValue: false;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    volumetricDivisor: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    maxShippingFee: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    insuranceFeeRate: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    insuranceMinFee: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    oversizedThreshold: {
        type: "float";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    oversizedSurcharge: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
}>;
/**
 * 件数阶梯计费计算器
 * 国内部分快递按件计费：首件 X 元 + 续件 Y 元
 * 支持：满额包邮、满件包邮、指定省份免邮、运费封顶
 */
export declare const tieredQuantityShippingCalculator: ShippingCalculator<{
    firstItemFee: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    additionalItemFee: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    freeShippingThreshold: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    freeShippingQuantity: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    freeShippingAreas: {
        type: "string";
        defaultValue: string;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    maxShippingFee: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
}>;
