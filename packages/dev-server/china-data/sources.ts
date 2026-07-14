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
