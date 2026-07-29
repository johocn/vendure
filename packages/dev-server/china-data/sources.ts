import { LanguageCode } from '@vendure/common/lib/generated-types';

// ===== Zone / Country =====
export const ZONES = [{ name: 'Asia' }];
export const COUNTRIES = [{ name: 'China', code: 'CN', zone: 'Asia' }];

// ===== TaxRate =====
export const TAX_RATES = [
    { name: '普通税率', percentage: 13 },
    { name: '优惠税率', percentage: 9 },
    { name: '零税率', percentage: 0 },
];

// ===== Facet / FacetValue =====
export const FACETS = [
    {
        code: 'category',
        name: '类目',
        values: [
            { name: '食品生鲜', code: 'food-fresh' },
            { name: '数码电器', code: 'digital-electronics' },
        ],
    },
    {
        code: 'brand',
        name: '品牌',
        values: [
            { name: '农夫山泉', code: 'nongfu' },
            { name: '三只松鼠', code: 'three-squirrel' },
            { name: '小米', code: 'xiaomi' },
            { name: '华为', code: 'huawei' },
        ],
    },
    {
        code: 'spec',
        name: '规格',
        values: [
            { name: '500ml', code: '500ml' },
            { name: '1kg', code: '1kg' },
            { name: '标准版', code: 'standard' },
            { name: 'Pro版', code: 'pro' },
        ],
    },
];

// ===== Collection =====
export const COLLECTIONS = [
    {
        name: '食品生鲜',
        facetValueNames: ['食品生鲜'],
        assetFile: 'nathan-fertig-249917-unsplash.jpg',
    },
    {
        name: '数码电器',
        facetValueNames: ['数码电器'],
        assetFile: 'chuttersnap-324234-unsplash.jpg',
    },
];

// ===== Products =====
export interface ProductSource {
    name: string;
    slug: string;
    description: string;
    brand: string;
    category: string;
    imageFile: string;
    variants: Array<{
        name: string;
        sku: string;
        price: number;
        stock: number;
        spec?: string;
        weight?: number;
        length?: number;
        width?: number;
        height?: number;
    }>;
}

export const PRODUCTS: ProductSource[] = [
    {
        name: '农夫山泉天然水',
        slug: 'nongfu-spring-water',
        description: '农夫山泉天然水 500ml',
        brand: '农夫山泉',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '500ml', sku: 'NF-WATER-500', price: 2, stock: 1000, spec: '500ml', weight: 0.52, length: 6, width: 6, height: 20 }],
    },
    {
        name: '三只松鼠坚果礼盒',
        slug: 'three-squirrel-nut-gift-box',
        description: '三只松鼠坚果礼盒 1kg',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'neonbrand-428982-unsplash.jpg',
        variants: [{ name: '1kg', sku: 'TS-NUT-1KG', price: 99, stock: 200, spec: '1kg', weight: 1.25, length: 30, width: 25, height: 8 }],
    },
    {
        name: '五常稻花香大米',
        slug: 'wuchang-rice',
        description: '五常稻花香大米 5kg',
        brand: '农夫山泉',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '5kg', sku: 'NF-RICE-5KG', price: 49, stock: 300, spec: '1kg', weight: 5.2, length: 35, width: 25, height: 8 }],
    },
    {
        name: '内蒙古牛肉卷',
        slug: 'inner-mongolia-beef-roll',
        description: '内蒙古牛肉卷 500g',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'brandi-redd-104140-unsplash.jpg',
        variants: [{ name: '500g', sku: 'TS-BEEF-500', price: 59, stock: 150, spec: '1kg', weight: 0.55, length: 20, width: 15, height: 5 }],
    },
    {
        name: '小米手环8',
        slug: 'xiaomi-band-8',
        description: '小米手环8',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-324234-unsplash.jpg',
        variants: [
            { name: '标准版', sku: 'XM-BAND-8-STD', price: 199, stock: 100, spec: '标准版', weight: 0.05, length: 12, width: 8, height: 3 },
            { name: 'Pro版', sku: 'XM-BAND-8-PRO', price: 299, stock: 80, spec: 'Pro版', weight: 0.06, length: 13, width: 9, height: 3 },
        ],
    },
    {
        name: '华为路由器',
        slug: 'huawei-router',
        description: '华为路由器',
        brand: '华为',
        category: '数码电器',
        imageFile: 'alexandru-acea-686569-unsplash.jpg',
        variants: [{ name: '标准版', sku: 'HW-ROUTER-STD', price: 159, stock: 120, spec: '标准版', weight: 0.35, length: 20, width: 15, height: 5 }],
    },
    {
        name: '小米充电宝',
        slug: 'xiaomi-power-bank',
        description: '小米充电宝 10000mAh',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-584518-unsplash.jpg',
        variants: [{ name: '10000mAh', sku: 'XM-PB-10000', price: 99, stock: 200, spec: '标准版', weight: 0.28, length: 15, width: 8, height: 3 }],
    },
    {
        name: '华为蓝牙耳机',
        slug: 'huawei-bluetooth-earphone',
        description: '华为蓝牙耳机',
        brand: '华为',
        category: '数码电器',
        imageFile: 'chuttersnap-584518-unsplash.jpg',
        variants: [{ name: '标准版', sku: 'HW-BT-EAR-STD', price: 399, stock: 60, spec: '标准版', weight: 0.12, length: 10, width: 8, height: 4 }],
    },
    // ===== 优惠券测试专用商品（覆盖各门槛价位段） =====
    {
        name: '可口可乐',
        slug: 'coca-cola-330ml',
        description: '可口可乐 330ml 单罐',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '330ml', sku: 'CC-COLA-330', price: 3, stock: 2000, spec: '330ml', weight: 0.36, length: 6, width: 6, height: 12 }],
    },
    {
        name: '康师傅方便面',
        slug: 'kangshifu-instant-noodles',
        description: '康师傅红烧牛肉面 5包装',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'neonbrand-428982-unsplash.jpg',
        variants: [{ name: '5包装', sku: 'KS-NOODLE-5PK', price: 25, stock: 500, spec: '5包装', weight: 0.5, length: 20, width: 15, height: 10 }],
    },
    {
        name: '蓝月亮洗衣液',
        slug: 'bluemoon-laundry-detergent',
        description: '蓝月亮洗衣液 3kg',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'brandi-redd-104140-unsplash.jpg',
        variants: [{ name: '3kg', sku: 'BM-DET-3KG', price: 45, stock: 300, spec: '3kg', weight: 3.1, length: 15, width: 12, height: 25 }],
    },
    {
        name: '小米电饭煲',
        slug: 'xiaomi-rice-cooker',
        description: '小米电饭煲 3L',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-324234-unsplash.jpg',
        variants: [{ name: '3L', sku: 'XM-COOKER-3L', price: 299, stock: 150, spec: '3L', weight: 3.5, length: 30, width: 30, height: 25 }],
    },
    {
        name: '华为手机壳',
        slug: 'huawei-phone-case',
        description: '华为手机壳 简约款',
        brand: '华为',
        category: '数码电器',
        imageFile: 'alexandru-acea-686569-unsplash.jpg',
        variants: [{ name: '简约款', sku: 'HW-CASE-SIMPLE', price: 15, stock: 800, spec: '简约款', weight: 0.05, length: 15, width: 8, height: 1 }],
    },
    {
        name: '小米蓝牙音箱',
        slug: 'xiaomi-bluetooth-speaker',
        description: '小米蓝牙音箱',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-584518-unsplash.jpg',
        variants: [{ name: '标准版', sku: 'XM-SPK-STD', price: 149, stock: 200, spec: '标准版', weight: 0.45, length: 18, width: 10, height: 8 }],
    },
    {
        name: '华为平板电脑',
        slug: 'huawei-tablet',
        description: '华为平板电脑 10.4寸',
        brand: '华为',
        category: '数码电器',
        imageFile: 'alexandru-acea-686569-unsplash.jpg',
        variants: [
            { name: '64GB', sku: 'HW-TAB-64G', price: 1299, stock: 50, spec: '64GB', weight: 0.48, length: 25, width: 16, height: 1 },
            { name: '128GB', sku: 'HW-TAB-128G', price: 1599, stock: 30, spec: '128GB', weight: 0.48, length: 25, width: 16, height: 1 },
        ],
    },
    {
        name: '三只松鼠零食大礼包',
        slug: 'three-squirrel-snack-bundle',
        description: '三只松鼠零食大礼包 10袋装',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'neonbrand-428982-unsplash.jpg',
        variants: [{ name: '10袋装', sku: 'TS-SNACK-10PK', price: 69, stock: 400, spec: '10袋装', weight: 1.5, length: 35, width: 25, height: 10 }],
    },
    {
        name: '农夫山泉矿泉水整箱',
        slug: 'nongfu-water-box',
        description: '农夫山泉矿泉水 550ml×24瓶 整箱',
        brand: '农夫山泉',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '24瓶装', sku: 'NF-WATER-24PK', price: 48, stock: 300, spec: '24瓶装', weight: 13, length: 40, width: 28, height: 25 }],
    },
];

// ===== Shipping Methods (default Channel) =====
// 注意：checker/calculator code 使用 vendure 默认及 cjk-plugin 注册的实际 code
// - default-shipping-eligibility-checker (arg: orderMinimum, 单位: 分)
// - default-shipping-calculator (args: rate/taxRate/includesTax, rate 单位: 分)
// - store-pickup-eligibility / store-pickup-calculator (cjk-plugin, 无参数)
// - pickup-point-eligibility / pickup-point-calculator (cjk-plugin, arg: shippingPrice, 单位: 分)
// - employee-pickup-eligibility / employee-pickup-calculator (cjk-plugin, arg: shippingPrice, 单位: 分)
// - tiered-shipping-eligibility-checker (cjk-plugin, args: orderMinimum/excludedAreas)
// - tiered-weight-shipping-calculator (cjk-plugin, args: firstWeight/firstWeightFee/additionalWeightUnit/additionalWeightFee/remoteAreaSurcharge/remoteAreas/freeShippingThreshold/freeShippingAreas/useVolumetricWeight/volumetricDivisor/maxShippingFee/insuranceFeeRate/insuranceMinFee/oversizedThreshold/oversizedSurcharge)
// - tiered-quantity-shipping-calculator (cjk-plugin, args: firstItemFee/additionalItemFee/freeShippingThreshold/freeShippingQuantity/freeShippingAreas/maxShippingFee)
// - fulfillmentHandler: manual-fulfillment / store-pickup / pickup-point / employee-pickup
export const DEFAULT_SHIPPING_METHODS = [
    {
        code: 'store-pickup',
        name: '门店自提',
        description: '到店自提，免运费',
        fulfillmentHandler: 'store-pickup',
        checker: { code: 'store-pickup-eligibility', arguments: [] },
        calculator: { code: 'store-pickup-calculator', arguments: [] },
    },
    {
        code: 'pickup-point',
        name: '菜鸟驿站自提',
        description: '到菜鸟驿站自提，3元',
        fulfillmentHandler: 'pickup-point',
        checker: { code: 'pickup-point-eligibility', arguments: [] },
        calculator: { code: 'pickup-point-calculator', arguments: [{ name: 'shippingPrice', value: '300' }] },
    },
    {
        code: 'free-shipping-99',
        name: '满99包邮',
        description: '订单满99元免运费',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'default-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '9900' }] },
        calculator: {
            code: 'default-shipping-calculator',
            arguments: [
                { name: 'rate', value: '0' },
                { name: 'taxRate', value: '0' },
                { name: 'includesTax', value: 'auto' },
            ],
        },
    },
    {
        code: 'sf-express',
        name: '顺丰标准快递',
        description: '顺丰标准快递 12元',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'default-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }] },
        calculator: {
            code: 'default-shipping-calculator',
            arguments: [
                { name: 'rate', value: '1200' },
                { name: 'taxRate', value: '0' },
                { name: 'includesTax', value: 'auto' },
            ],
        },
    },
    {
        code: 'employee-pickup',
        name: '企业职工自提',
        description: '企业职工自提点自提',
        fulfillmentHandler: 'employee-pickup',
        checker: { code: 'employee-pickup-eligibility', arguments: [] },
        calculator: { code: 'employee-pickup-calculator', arguments: [{ name: 'shippingPrice', value: '0' }] },
    },
    // ===== 阶梯重量计费配送方式 =====
    // 中通快递：首重1kg 8元，续重1kg 3元，偏远地区+10元
    {
        code: 'zto-express',
        name: '中通快递',
        description: '首重1kg 8元，续重1kg 3元，偏远地区+10元',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '800' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '300' },
                { name: 'remoteAreaSurcharge', value: '1000' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'false' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '0' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
    },
    // 顺丰特快：首重1kg 18元，续重1kg 8元，偏远地区+15元，启用体积重，保价费千分之五
    {
        code: 'sf-express-fast',
        name: '顺丰特快',
        description: '首重1kg 18元，续重1kg 8元，偏远地区+15元，含体积重+保价费',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '1800' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '800' },
                { name: 'remoteAreaSurcharge', value: '1500' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'true' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '0' },
                { name: 'insuranceFeeRate', value: '5' },
                { name: 'insuranceMinFee', value: '100' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
    },
    // 京东物流：首重1kg 10元，续重1kg 4元，满199包邮
    {
        code: 'jd-logistics',
        name: '京东物流',
        description: '首重1kg 10元，续重1kg 4元，满199元包邮',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '1000' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '400' },
                { name: 'remoteAreaSurcharge', value: '1200' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '19900' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'false' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '0' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
    },
    // 德邦快递：首重3kg 15元，续重1kg 3元，超重+10元，运费封顶200元，适合大件
    {
        code: 'deppon-express',
        name: '德邦快递',
        description: '首重3kg 15元，续重1kg 3元，单件超10kg+10元，运费封顶200元',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '3' },
                { name: 'firstWeightFee', value: '1500' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '300' },
                { name: 'remoteAreaSurcharge', value: '2000' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'true' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '20000' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '10' },
                { name: 'oversizedSurcharge', value: '1000' },
            ],
        },
    },
    // 申通快递：件数计费，首件6元，续件2元，满3件包邮，广东省内免邮
    {
        code: 'sto-express',
        name: '申通快递',
        description: '首件6元，续件2元，满3件包邮，广东省内免邮',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-quantity-shipping-calculator',
            arguments: [
                { name: 'firstItemFee', value: '600' },
                { name: 'additionalItemFee', value: '200' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingQuantity', value: '3' },
                { name: 'freeShippingAreas', value: '广东' },
                { name: 'maxShippingFee', value: '0' },
            ],
        },
    },
    // 圆通速运：首重1kg 7元，续重1kg 2元，运费封顶100元，满299包邮，江浙沪免邮
    {
        code: 'yto-express',
        name: '圆通速运',
        description: '首重1kg 7元，续重1kg 2元，运费封顶100元，满299包邮，江浙沪免邮',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '700' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '200' },
                { name: 'remoteAreaSurcharge', value: '800' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '29900' },
                { name: 'freeShippingAreas', value: '上海,江苏,浙江' },
                { name: 'useVolumetricWeight', value: 'false' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '10000' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
    },
];

// ===== Shipping Methods (shop-a Channel) =====
// 注意：每个 channel 需独立创建 ShippingMethod 实例（即使 code 相同）
export const SHOP_A_SHIPPING_METHODS = [
    DEFAULT_SHIPPING_METHODS[0], // store-pickup
    DEFAULT_SHIPPING_METHODS[2], // free-shipping-99
    DEFAULT_SHIPPING_METHODS.find(sm => sm.code === 'employee-pickup')!, // employee-pickup（shop-a strict 模式）
];

// ===== Global Shipping Templates =====
// 全局模板由超级管理员维护，所有租户可选用
// 描述字段需详尽，让租户了解配置后的具体行为
export interface ShippingTemplateSource {
    name: string;
    description: string;
    code: string;
    fulfillmentHandler: string;
    checker: { code: string; arguments: Array<{ name: string; value: string }> };
    calculator: { code: string; arguments: Array<{ name: string; value: string }> };
    isGlobal: boolean;
}

export const GLOBAL_SHIPPING_TEMPLATES: ShippingTemplateSource[] = [
    {
        name: '门店自提',
        description: '顾客到门店自提商品，免运费。\n\n履约方式：门店自提（store-pickup）\n费用计算：免运费\n适用场景：有实体店面的商家，顾客下单后选择就近门店提货\n适用条件：无最低订单金额限制',
        code: 'store-pickup',
        fulfillmentHandler: 'store-pickup',
        checker: { code: 'store-pickup-eligibility', arguments: [] },
        calculator: { code: 'store-pickup-calculator', arguments: [] },
        isGlobal: true,
    },
    {
        name: '菜鸟驿站自提',
        description: '顾客到菜鸟驿站自提商品，固定运费3元。\n\n履约方式：驿站自提（pickup-point）\n费用计算：固定3元\n适用场景：无实体店面但希望提供自提选项的商家\n适用条件：无最低订单金额限制',
        code: 'pickup-point',
        fulfillmentHandler: 'pickup-point',
        checker: { code: 'pickup-point-eligibility', arguments: [] },
        calculator: { code: 'pickup-point-calculator', arguments: [{ name: 'shippingPrice', value: '300' }] },
        isGlobal: true,
    },
    {
        name: '企业职工自提',
        description: '企业职工在指定自提点提货，免运费。需验证职工身份。\n\n履约方式：职工自提（employee-pickup）\n费用计算：免运费\n适用场景：企业内部团购或员工福利场景\n适用条件：需职工身份验证（EmployeeCustomer 绑定）',
        code: 'employee-pickup',
        fulfillmentHandler: 'employee-pickup',
        checker: { code: 'employee-pickup-eligibility', arguments: [] },
        calculator: { code: 'employee-pickup-calculator', arguments: [{ name: 'shippingPrice', value: '0' }] },
        isGlobal: true,
    },
    {
        name: '满额包邮',
        description: '订单满99元免运费，未满则不收取运费。\n\n履约方式：手动履约（manual-fulfillment）\n费用计算：固定运费0元，满额免运费\n适用场景：希望提升客单价的商家\n适用条件：最低订单金额99元（可配置）\n参数说明：orderMinimum 控制最低订单金额（单位：分），rate 控制基础运费（单位：分）',
        code: 'free-shipping-99',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'default-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '9900' }] },
        calculator: {
            code: 'default-shipping-calculator',
            arguments: [
                { name: 'rate', value: '0' },
                { name: 'taxRate', value: '0' },
                { name: 'includesTax', value: 'auto' },
            ],
        },
        isGlobal: true,
    },
    {
        name: '顺丰标准快递',
        description: '顺丰速运标准快递，固定运费12元。\n\n履约方式：手动履约\n费用计算：固定12元\n适用场景：对时效要求高的商品\n适用条件：无最低订单金额限制\n参数说明：rate 控制运费金额（单位：分，1200=12元）',
        code: 'sf-express',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'default-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }] },
        calculator: {
            code: 'default-shipping-calculator',
            arguments: [
                { name: 'rate', value: '1200' },
                { name: 'taxRate', value: '0' },
                { name: 'includesTax', value: 'auto' },
            ],
        },
        isGlobal: true,
    },
    {
        name: '顺丰特快',
        description: '顺丰速运特快服务，按重量阶梯计费，含体积重和保价费。\n\n履约方式：手动履约\n费用计算：首重1kg 18元 + 续重1kg 8元，偏远地区+15元\n体积重：启用（除数6000，适用于大体积轻量商品）\n保价费：千分之五（最低1元）\n适用场景：贵重物品、大件商品，对时效要求极高\n适用条件：无最低订单金额限制\n偏远地区：新疆、西藏、青海、内蒙古、宁夏、甘肃\n参数说明：firstWeight/firstWeightFee 控制首重，additionalWeightFee 控制续重单价，useVolumetricWeight 启用体积重，insuranceFeeRate 控制保价费率',
        code: 'sf-express-fast',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '1800' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '800' },
                { name: 'remoteAreaSurcharge', value: '1500' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'true' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '0' },
                { name: 'insuranceFeeRate', value: '5' },
                { name: 'insuranceMinFee', value: '100' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
        isGlobal: true,
    },
    {
        name: '中通快递',
        description: '中通快递按重量阶梯计费，性价比高，适合日常商品配送。\n\n履约方式：手动履约\n费用计算：首重1kg 8元 + 续重1kg 3元，偏远地区+10元\n体积重：不启用\n适用场景：日常商品配送，经济实惠\n适用条件：无最低订单金额限制\n偏远地区：新疆、西藏、青海、内蒙古、宁夏、甘肃\n参数说明：firstWeight/firstWeightFee 控制首重，additionalWeightFee 控制续重单价，remoteAreaSurcharge 控制偏远地区附加费',
        code: 'zto-express',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '800' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '300' },
                { name: 'remoteAreaSurcharge', value: '1000' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'false' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '0' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
        isGlobal: true,
    },
    {
        name: '京东物流',
        description: '京东物流按重量阶梯计费，满199元包邮，配送时效有保障。\n\n履约方式：手动履约\n费用计算：首重1kg 10元 + 续重1kg 4元，满199元免运费，偏远地区+12元\n体积重：不启用\n适用场景：需要京东配送体系的商家\n适用条件：无最低订单金额限制，满199元免运费\n偏远地区：新疆、西藏、青海、内蒙古、宁夏、甘肃\n参数说明：freeShippingThreshold 控制满额包邮门槛（19900=199元）',
        code: 'jd-logistics',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '1000' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '400' },
                { name: 'remoteAreaSurcharge', value: '1200' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '19900' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'false' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '0' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
        isGlobal: true,
    },
    {
        name: '圆通速运',
        description: '圆通速运按重量阶梯计费，运费封顶100元，满299元包邮，江浙沪地区免邮。\n\n履约方式：手动履约\n费用计算：首重1kg 7元 + 续重1kg 2元，运费封顶100元\n满额包邮：满299元免运费\n免邮地区：上海、江苏、浙江\n偏远地区：+8元（新疆、西藏、青海、内蒙古、宁夏、甘肃）\n适用场景：日常商品配送，经济实惠\n适用条件：无最低订单金额限制\n参数说明：maxShippingFee 控制运费封顶（10000=100元），freeShippingAreas 控制免邮地区',
        code: 'yto-express',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '1' },
                { name: 'firstWeightFee', value: '700' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '200' },
                { name: 'remoteAreaSurcharge', value: '800' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '29900' },
                { name: 'freeShippingAreas', value: '上海,江苏,浙江' },
                { name: 'useVolumetricWeight', value: 'false' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '10000' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '0' },
                { name: 'oversizedSurcharge', value: '0' },
            ],
        },
        isGlobal: true,
    },
    {
        name: '德邦快递',
        description: '德邦快递按重量阶梯计费，适合大件商品，含体积重计算和超重附加费。\n\n履约方式：手动履约\n费用计算：首重3kg 15元 + 续重1kg 3元\n超重附加费：单件超10kg +10元\n运费封顶：200元\n体积重：启用（除数6000）\n偏远地区：+20元（新疆、西藏、青海、内蒙古、宁夏、甘肃）\n适用场景：家具、家电等大件商品配送\n适用条件：无最低订单金额限制\n参数说明：firstWeight=3 首重3kg，oversizedThreshold/oversizedSurcharge 控制超重附加费，useVolumetricWeight 启用体积重',
        code: 'deppon-express',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-weight-shipping-calculator',
            arguments: [
                { name: 'firstWeight', value: '3' },
                { name: 'firstWeightFee', value: '1500' },
                { name: 'additionalWeightUnit', value: '1' },
                { name: 'additionalWeightFee', value: '300' },
                { name: 'remoteAreaSurcharge', value: '2000' },
                { name: 'remoteAreas', value: '新疆,西藏,青海,内蒙古,宁夏,甘肃' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingAreas', value: '' },
                { name: 'useVolumetricWeight', value: 'true' },
                { name: 'volumetricDivisor', value: '6000' },
                { name: 'maxShippingFee', value: '20000' },
                { name: 'insuranceFeeRate', value: '0' },
                { name: 'insuranceMinFee', value: '0' },
                { name: 'oversizedThreshold', value: '10' },
                { name: 'oversizedSurcharge', value: '1000' },
            ],
        },
        isGlobal: true,
    },
    {
        name: '申通快递（按件计费）',
        description: '申通快递按件数计费，满3件包邮，广东省内免邮。适用于多件小商品配送。\n\n履约方式：手动履约\n费用计算：首件6元 + 续件2元\n满件包邮：满3件免运费\n免邮地区：广东省\n适用场景：多件小商品配送\n适用条件：无最低订单金额限制\n参数说明：firstItemFee/additionalItemFee 控制件数计费，freeShippingQuantity 控制满件包邮门槛，freeShippingAreas 控制免邮地区',
        code: 'sto-express',
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'tiered-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }, { name: 'excludedAreas', value: '' }] },
        calculator: {
            code: 'tiered-quantity-shipping-calculator',
            arguments: [
                { name: 'firstItemFee', value: '600' },
                { name: 'additionalItemFee', value: '200' },
                { name: 'freeShippingThreshold', value: '0' },
                { name: 'freeShippingQuantity', value: '3' },
                { name: 'freeShippingAreas', value: '广东' },
                { name: 'maxShippingFee', value: '0' },
            ],
        },
        isGlobal: true,
    },
];

// ===== Payment Methods =====
export const PAYMENT_METHODS = [
    {
        code: 'dummy-payment',
        name: '测试支付',
        description: '开发环境测试支付',
        handler: { code: 'dummy-payment-handler', arguments: [{ name: 'automaticSettle', value: 'false' }] },
    },
    {
        code: 'cash-on-delivery',
        name: '货到付款',
        description: '收货时支付现金',
        handler: { code: 'cash-on-delivery', arguments: [] },
    },
    {
        code: 'balance-pay',
        name: '余额支付',
        description: '使用充值卡余额支付',
        handler: { code: 'balance-pay', arguments: [] },
    },
];

// ===== Pickup Locations =====
export const DEFAULT_PICKUP_LOCATIONS = [
    {
        name: '中关村门店', type: 'store' as const, address: '北京市海淀区中关村大街1号',
        phoneNumber: '010-12345678', businessHours: '09:00-22:00',
        coordinates: { lat: 39.984702, lng: 116.311407 },
    },
    {
        name: '望京SOHO店', type: 'store' as const, address: '北京市朝阳区望京街10号',
        phoneNumber: '010-87654321', businessHours: '09:00-21:00',
        coordinates: { lat: 39.995830, lng: 116.478850 },
    },
    {
        name: '菜鸟驿站(五道口店)', type: 'point' as const, address: '北京市海淀区成府路28号',
        phoneNumber: '010-66668888', businessHours: '08:00-22:00',
        coordinates: { lat: 39.992870, lng: 116.337650 },
    },
    {
        name: '双阳商城店', type: 'store' as const, address: '吉林省长春市双阳区西双阳大街188号',
        phoneNumber: '0431-84221001', businessHours: '08:30-20:30',
        coordinates: { lat: 43.526210, lng: 125.664780 },
    },
    {
        name: '菜鸟驿站(双阳泰山店)', type: 'point' as const, address: '吉林省长春市双阳区泰山路25号',
        phoneNumber: '0431-84221202', businessHours: '08:00-21:00',
        coordinates: { lat: 43.528890, lng: 125.665420 },
    },
    {
        name: '长春科技学院自提点', type: 'employee' as const, address: '吉林省长春市双阳区双阳大街1697号',
        phoneNumber: '0431-84221666', businessHours: '09:00-17:00',
        coordinates: { lat: 43.533450, lng: 125.671230 },
        isPublic: true,
    },
    // ===== store 门店自提（补充3条，达到7条）=====
    {
        name: '双阳欧亚商场店', type: 'store' as const, address: '吉林省长春市双阳区嵩山路99号',
        phoneNumber: '0431-84223001', businessHours: '08:30-21:00',
        coordinates: { lat: 43.527010, lng: 125.662100 },
        isPublic: true,
    },
    {
        name: '双阳商贸城店', type: 'store' as const, address: '吉林省长春市双阳区东双阳大街288号',
        phoneNumber: '0431-84223002', businessHours: '08:00-20:00',
        coordinates: { lat: 43.524580, lng: 125.667850 },
        isPublic: true,
    },
    {
        name: '双阳鼎盛广场店', type: 'store' as const, address: '吉林省长春市双阳区鼎盛路168号',
        phoneNumber: '0431-84223010', businessHours: '09:00-21:30',
        coordinates: { lat: 43.526800, lng: 125.670100 },
        isPublic: true,
    },
    // ===== point 菜鸟驿站（补充4条，达到6条）=====
    {
        name: '菜鸟驿站(双阳华昌店)', type: 'point' as const, address: '吉林省长春市双阳区华昌路50号',
        phoneNumber: '0431-84223003', businessHours: '08:00-21:00',
        coordinates: { lat: 43.529100, lng: 125.663500 },
        isPublic: true,
    },
    {
        name: '菜鸟驿站(双阳站前店)', type: 'point' as const, address: '吉林省长春市双阳区站前路18号',
        phoneNumber: '0431-84223004', businessHours: '08:00-22:00',
        coordinates: { lat: 43.530550, lng: 125.669200 },
        isPublic: true,
    },
    {
        name: '菜鸟驿站(双阳清江店)', type: 'point' as const, address: '吉林省长春市双阳区清江路66号',
        phoneNumber: '0431-84223005', businessHours: '08:30-21:30',
        coordinates: { lat: 43.525120, lng: 125.671800 },
        isPublic: true,
    },
    {
        name: '菜鸟驿站(双阳阳光店)', type: 'point' as const, address: '吉林省长春市双阳区阳光路120号',
        phoneNumber: '0431-84223011', businessHours: '08:00-22:00',
        coordinates: { lat: 43.527500, lng: 125.664900 },
        isPublic: true,
    },
    // ===== employee 企业职工自提（补充5条，达到6条）=====
    {
        name: '吉林农业大学自提点', type: 'employee' as const, address: '吉林省长春市双阳区新城大街2888号',
        phoneNumber: '0431-84223006', businessHours: '08:00-18:00',
        coordinates: { lat: 43.531120, lng: 125.679840 },
        isPublic: true,
    },
    {
        name: '长春大学自提点', type: 'employee' as const, address: '吉林省长春市双阳区大学城路1号',
        phoneNumber: '0431-84223007', businessHours: '08:00-17:30',
        coordinates: { lat: 43.534200, lng: 125.673500 },
        isPublic: true,
    },
    {
        name: '双阳经济开发区自提点', type: 'employee' as const, address: '吉林省长春市双阳区经济开发区创业路88号',
        phoneNumber: '0431-84223008', businessHours: '08:30-17:00',
        coordinates: { lat: 43.522300, lng: 125.675100 },
        isPublic: true,
    },
    {
        name: '长春职业技术学院自提点', type: 'employee' as const, address: '吉林省长春市双阳区职教路66号',
        phoneNumber: '0431-84223009', businessHours: '08:00-18:00',
        coordinates: { lat: 43.528800, lng: 125.678200 },
        isPublic: true,
    },
    {
        name: '吉林建筑大学自提点', type: 'employee' as const, address: '吉林省长春市双阳区建大路200号',
        phoneNumber: '0431-84223012', businessHours: '08:00-17:00',
        coordinates: { lat: 43.532900, lng: 125.676500 },
        isPublic: true,
    },
];

export const SHOP_A_PICKUP_LOCATIONS = [
    {
        name: '生鲜自提点(国贸店)', type: 'store' as const, address: '北京市朝阳区建国门外大街1号',
        phoneNumber: '010-11112222', businessHours: '07:00-21:00',
        coordinates: { lat: 39.908160, lng: 116.459790 },
    },
    {
        name: '双阳生鲜自提点', type: 'store' as const, address: '吉林省长春市双阳区东双阳大街555号',
        phoneNumber: '0431-84222888', businessHours: '07:00-21:00',
        coordinates: { lat: 43.525870, lng: 125.668950 },
    },
    {
        name: '吉林农业大学自提点', type: 'employee' as const, address: '吉林省长春市双阳区新城大街2888号',
        phoneNumber: '0431-84222999', businessHours: '08:00-18:00',
        coordinates: { lat: 43.531120, lng: 125.679840 },
        isPublic: false,
    },
];

// ===== Promotions =====
export interface PromotionSource {
    name: string;
    couponCode: string;
    channel: 'default' | 'shop-a';
    conditions: Array<{ code: string; arguments: Array<{ name: string; value: string }> }>;
    actions: Array<{ code: string; arguments: Array<{ name: string; value: string }> }>;
    customFields?: { stackable?: boolean; stackableGroup?: string | null; maxStackableWith?: number | null };
}

export const PROMOTIONS: PromotionSource[] = [
    {
        name: '满100减10',
        couponCode: 'SAVE10',
        channel: 'default',
        conditions: [{ code: 'minimum_order_amount', arguments: [{ name: 'amount', value: '10000' }] }],
        actions: [{ code: 'order_fixed_discount', arguments: [{ name: 'discount', value: '1000' }] }],
    },
    {
        name: '新人9折',
        couponCode: 'NEW90',
        channel: 'shop-a',
        conditions: [{ code: 'minimum_order_amount', arguments: [{ name: 'amount', value: '0' }] }],
        actions: [{ code: 'order_percentage_discount', arguments: [{ name: 'discount', value: '10' }] }],
        customFields: { stackable: true, stackableGroup: null, maxStackableWith: null },
    },
    {
        name: '满50减5',
        couponCode: 'SAVE5',
        channel: 'shop-a',
        conditions: [{ code: 'minimum_order_amount', arguments: [{ name: 'amount', value: '5000' }] }],
        actions: [{ code: 'order_fixed_discount', arguments: [{ name: 'discount', value: '500' }] }],
        customFields: { stackable: true, stackableGroup: null, maxStackableWith: null },
    },
];

// ===== Customers =====
export interface CustomerSource {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    emailAddress: string;
    channel: 'default' | 'shop-a';
    balance: number; // 元，0 表示不创建余额
    address: {
        streetLine1: string;
        city: string;
        province: string;
        postalCode: string;
        country: string; // China
    };
}

export const CUSTOMERS: CustomerSource[] = [
    {
        firstName: '三',
        lastName: '张',
        phoneNumber: '13800138001',
        emailAddress: 'zhangsan@test.cn',
        channel: 'default',
        balance: 0,
        address: {
            streetLine1: '北京市海淀区中关村大街1号',
            city: '北京市',
            province: '北京市',
            postalCode: '100080',
            country: 'China',
        },
    },
    {
        firstName: '四',
        lastName: '李',
        phoneNumber: '13800138002',
        emailAddress: 'lisi@test.cn',
        channel: 'default',
        balance: 500,
        address: {
            streetLine1: '北京市朝阳区望京街10号',
            city: '北京市',
            province: '北京市',
            postalCode: '100102',
            country: 'China',
        },
    },
    {
        firstName: '五',
        lastName: '王',
        phoneNumber: '13800138003',
        emailAddress: 'wangwu@test.cn',
        channel: 'shop-a',
        balance: 200,
        address: {
            streetLine1: '北京市朝阳区建国门外大街1号',
            city: '北京市',
            province: '北京市',
            postalCode: '100020',
            country: 'China',
        },
    },
];

// ===== Orders =====
export interface OrderSource {
    channel: 'default' | 'shop-a';
    customerEmail: string;
    items: Array<{ sku: string; quantity: number }>;
    shippingMethodCode: string;
    paymentMethodCode?: string; // 不传则不付款
    state: 'ArrangingPayment' | 'PaymentSettled' | 'Shipped' | 'Completed' | 'Cancelled';
    couponCodes?: string[];
}

export const ORDERS: OrderSource[] = [
    {
        channel: 'default',
        customerEmail: 'zhangsan@test.cn',
        items: [{ sku: 'NF-WATER-500', quantity: 5 }],
        shippingMethodCode: 'sf-express',
        state: 'ArrangingPayment',
    },
    {
        channel: 'default',
        customerEmail: 'zhangsan@test.cn',
        items: [{ sku: 'TS-NUT-1KG', quantity: 1 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'dummy-payment',
        state: 'PaymentSettled',
    },
    {
        channel: 'default',
        customerEmail: 'lisi@test.cn',
        items: [{ sku: 'NF-RICE-5KG', quantity: 2 }, { sku: 'TS-BEEF-500', quantity: 1 }],
        shippingMethodCode: 'sf-express',
        paymentMethodCode: 'dummy-payment',
        state: 'Shipped',
    },
    {
        channel: 'default',
        customerEmail: 'lisi@test.cn',
        items: [{ sku: 'XM-BAND-8-STD', quantity: 1 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'dummy-payment',
        state: 'Completed',
    },
    {
        channel: 'default',
        customerEmail: 'zhangsan@test.cn',
        items: [{ sku: 'HW-ROUTER-STD', quantity: 1 }],
        shippingMethodCode: 'sf-express',
        state: 'Cancelled',
    },
    {
        channel: 'shop-a',
        customerEmail: 'wangwu@test.cn',
        items: [{ sku: 'TS-NUT-1KG', quantity: 1 }],
        shippingMethodCode: 'store-pickup',
        state: 'ArrangingPayment',
    },
    {
        channel: 'shop-a',
        customerEmail: 'wangwu@test.cn',
        items: [{ sku: 'NF-RICE-5KG', quantity: 3 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'cash-on-delivery',
        state: 'PaymentSettled',
        couponCodes: ['NEW90', 'SAVE5'],
    },
    {
        channel: 'shop-a',
        customerEmail: 'wangwu@test.cn',
        items: [{ sku: 'XM-PB-10000', quantity: 1 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'dummy-payment',
        state: 'Shipped',
    },
];

// ===== Global Coupons (全局优惠券) =====
// 全局优惠券由超级管理员创建，所有渠道可见
// 金额单位：分（与 Vendure 一致）
export interface CouponSource {
    name: string;
    description: string;
    couponType: 'fixed' | 'percentage';
    discountValue: number; // fixed: 分; percentage: 百分比
    minSpend: number; // 门槛（分），0=无门槛
    maxDiscount: number; // 最大折扣封顶（分），0=不封顶
    startAt: string; // ISO date
    endAt: string;
    totalQuantity: number;
    limitPerUser: number;
    isActive: boolean;
    isNewUserOnly: boolean;
    isGlobal: boolean;
}

export const GLOBAL_COUPONS: CouponSource[] = [
    {
        name: '新人无门槛券',
        description: '新人专享，无门槛立减10元，每个用户限领1张',
        couponType: 'fixed',
        discountValue: 1000,
        minSpend: 0,
        maxDiscount: 0,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 1000,
        limitPerUser: 1,
        isActive: true,
        isNewUserOnly: true,
        isGlobal: true,
    },
    {
        name: '满99减10',
        description: '订单满99元可用，立减10元，每个用户限领3张',
        couponType: 'fixed',
        discountValue: 1000,
        minSpend: 9900,
        maxDiscount: 0,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 5000,
        limitPerUser: 3,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
    {
        name: '满199减30',
        description: '订单满199元可用，立减30元，每个用户限领2张',
        couponType: 'fixed',
        discountValue: 3000,
        minSpend: 19900,
        maxDiscount: 0,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 3000,
        limitPerUser: 2,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
    {
        name: '满299减50',
        description: '订单满299元可用，立减50元，每个用户限领1张',
        couponType: 'fixed',
        discountValue: 5000,
        minSpend: 29900,
        maxDiscount: 0,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 2000,
        limitPerUser: 1,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
    {
        name: '满499减100',
        description: '订单满499元可用，立减100元，每个用户限领1张',
        couponType: 'fixed',
        discountValue: 10000,
        minSpend: 49900,
        maxDiscount: 0,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 1000,
        limitPerUser: 1,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
    {
        name: '全场9折券',
        description: '全场商品9折优惠，最高减50元，每个用户限领2张',
        couponType: 'percentage',
        discountValue: 10,
        minSpend: 0,
        maxDiscount: 5000,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 5000,
        limitPerUser: 2,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
    {
        name: '全场8.5折券',
        description: '全场商品8.5折优惠，最高减200元，每个用户限领1张',
        couponType: 'percentage',
        discountValue: 15,
        minSpend: 0,
        maxDiscount: 20000,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 1000,
        limitPerUser: 1,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
    {
        name: '新人专享8折券',
        description: '新人专享，全场商品8折优惠，最高减100元，每个用户限领1张',
        couponType: 'percentage',
        discountValue: 20,
        minSpend: 0,
        maxDiscount: 10000,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 500,
        limitPerUser: 1,
        isActive: true,
        isNewUserOnly: true,
        isGlobal: true,
    },
    {
        name: '无门槛5元代金券',
        description: '无门槛立减5元，每个用户限领1张',
        couponType: 'fixed',
        discountValue: 500,
        minSpend: 0,
        maxDiscount: 0,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 8000,
        limitPerUser: 1,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
    {
        name: '大额满减券',
        description: '订单满999元可用，立减200元，每个用户限领1张',
        couponType: 'fixed',
        discountValue: 20000,
        minSpend: 99900,
        maxDiscount: 0,
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-12-31T23:59:59.000Z',
        totalQuantity: 500,
        limitPerUser: 1,
        isActive: true,
        isNewUserOnly: false,
        isGlobal: true,
    },
];
