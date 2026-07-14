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
    variants: Array<{ name: string; sku: string; price: number; stock: number; spec?: string }>;
}

export const PRODUCTS: ProductSource[] = [
    {
        name: '农夫山泉天然水',
        slug: 'nongfu-spring-water',
        description: '农夫山泉天然水 500ml',
        brand: '农夫山泉',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '500ml', sku: 'NF-WATER-500', price: 2, stock: 1000, spec: '500ml' }],
    },
    {
        name: '三只松鼠坚果礼盒',
        slug: 'three-squirrel-nut-gift-box',
        description: '三只松鼠坚果礼盒 1kg',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'neonbrand-428982-unsplash.jpg',
        variants: [{ name: '1kg', sku: 'TS-NUT-1KG', price: 99, stock: 200, spec: '1kg' }],
    },
    {
        name: '五常稻花香大米',
        slug: 'wuchang-rice',
        description: '五常稻花香大米 5kg',
        brand: '农夫山泉',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '5kg', sku: 'NF-RICE-5KG', price: 49, stock: 300, spec: '1kg' }],
    },
    {
        name: '内蒙古牛肉卷',
        slug: 'inner-mongolia-beef-roll',
        description: '内蒙古牛肉卷 500g',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'brandi-redd-104140-unsplash.jpg',
        variants: [{ name: '500g', sku: 'TS-BEEF-500', price: 59, stock: 150, spec: '1kg' }],
    },
    {
        name: '小米手环8',
        slug: 'xiaomi-band-8',
        description: '小米手环8',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-324234-unsplash.jpg',
        variants: [
            { name: '标准版', sku: 'XM-BAND-8-STD', price: 199, stock: 100, spec: '标准版' },
            { name: 'Pro版', sku: 'XM-BAND-8-PRO', price: 299, stock: 80, spec: 'Pro版' },
        ],
    },
    {
        name: '华为路由器',
        slug: 'huawei-router',
        description: '华为路由器',
        brand: '华为',
        category: '数码电器',
        imageFile: 'alexandru-acea-686569-unsplash.jpg',
        variants: [{ name: '标准版', sku: 'HW-ROUTER-STD', price: 159, stock: 120, spec: '标准版' }],
    },
    {
        name: '小米充电宝',
        slug: 'xiaomi-power-bank',
        description: '小米充电宝 10000mAh',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-584518-unsplash.jpg',
        variants: [{ name: '10000mAh', sku: 'XM-PB-10000', price: 99, stock: 200, spec: '标准版' }],
    },
    {
        name: '华为蓝牙耳机',
        slug: 'huawei-bluetooth-earphone',
        description: '华为蓝牙耳机',
        brand: '华为',
        category: '数码电器',
        imageFile: 'chuttersnap-584518-unsplash.jpg',
        variants: [{ name: '标准版', sku: 'HW-BT-EAR-STD', price: 399, stock: 60, spec: '标准版' }],
    },
];

// ===== Shipping Methods (default Channel) =====
// 注意：checker/calculator code 使用 vendure 默认及 cjk-plugin 注册的实际 code
// - default-shipping-eligibility-checker (arg: orderMinimum, 单位: 分)
// - default-shipping-calculator (args: rate/taxRate/includesTax, rate 单位: 分)
// - store-pickup-eligibility / store-pickup-calculator (cjk-plugin, 无参数)
// - pickup-point-eligibility / pickup-point-calculator (cjk-plugin, arg: shippingPrice, 单位: 分)
// - fulfillmentHandler: manual-fulfillment / store-pickup / pickup-point
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
];

// ===== Shipping Methods (shop-a Channel) =====
export const SHOP_A_SHIPPING_METHODS = [
    DEFAULT_SHIPPING_METHODS[0], // store-pickup
    DEFAULT_SHIPPING_METHODS[2], // free-shipping-99
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
    { name: '中关村门店', type: 'store' as const, address: '北京市海淀区中关村大街1号', phoneNumber: '010-12345678', businessHours: '09:00-22:00' },
    { name: '望京SOHO店', type: 'store' as const, address: '北京市朝阳区望京街10号', phoneNumber: '010-87654321', businessHours: '09:00-21:00' },
    { name: '菜鸟驿站(五道口店)', type: 'point' as const, address: '北京市海淀区成府路28号', phoneNumber: '010-66668888', businessHours: '08:00-22:00' },
];

export const SHOP_A_PICKUP_LOCATIONS = [
    { name: '生鲜自提点(国贸店)', type: 'store' as const, address: '北京市朝阳区建国门外大街1号', phoneNumber: '010-11112222', businessHours: '07:00-21:00' },
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
        conditions: [{ code: 'order-total', arguments: [{ name: 'minimum', value: '10000' }] }],
        actions: [{ code: 'order-fixed-discount', arguments: [{ name: 'discount', value: '1000' }] }],
    },
    {
        name: '新人9折',
        couponCode: 'NEW90',
        channel: 'shop-a',
        conditions: [{ code: 'order-total', arguments: [{ name: 'minimum', value: '0' }] }],
        actions: [{ code: 'order-percentage-discount', arguments: [{ name: 'discount', value: '10' }] }],
        customFields: { stackable: true, stackableGroup: null, maxStackableWith: null },
    },
    {
        name: '满50减5',
        couponCode: 'SAVE5',
        channel: 'shop-a',
        conditions: [{ code: 'order-total', arguments: [{ name: 'minimum', value: '5000' }] }],
        actions: [{ code: 'order-fixed-discount', arguments: [{ name: 'discount', value: '500' }] }],
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
        paymentMethodCode: 'balance-pay',
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
        items: [{ sku: 'NF-RICE-5KG', quantity: 2 }],
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
        paymentMethodCode: 'balance-pay',
        state: 'Shipped',
    },
];
