import { describe, expect, test } from 'vitest';
import {
    buildAwaitingAddressText,
    buildBindGuideText,
    buildInvalidOrderText,
    buildNewsMessage,
    buildOrderSuccessText,
    buildPhoneTakenText,
    buildTextListMessage,
    formatPrice,
} from './card-builder';
import { CardProduct } from './types';

const products: CardProduct[] = [
    { index: 1, productId: '11', title: '海天生抽酱油 500ml', price: 890, thumbnail: 'https://cdn.example.com/a.jpg', url: 'https://shop.example.com/soy-sauce' },
    { index: 2, productId: '12', title: '金龙鱼大米 5kg', price: 0 },
];

describe('formatPrice', () => {
    test('fen to yuan', () => {
        expect(formatPrice(890)).toBe('¥8.90');
        expect(formatPrice(0)).toBe('价格面议');
        expect(formatPrice(undefined)).toBe('价格面议');
    });
});

describe('buildNewsMessage', () => {
    test('maps products to articles with order guide', () => {
        const msg = buildNewsMessage('oX', products)!;
        expect(msg.kind).toBe('news');
        expect(msg.articles.length).toBe(2);
        expect(msg.articles[0]).toEqual({
            title: '1. 海天生抽酱油 500ml',
            description: '¥8.90\n回复「1」立即下单',
            url: 'https://shop.example.com/soy-sauce',
            picurl: 'https://cdn.example.com/a.jpg',
        });
    });
    test('empty products returns null', () => {
        expect(buildNewsMessage('oX', [])).toBeNull();
    });
    test('caps at 8 articles', () => {
        const many = Array.from({ length: 12 }, (_, i) => ({ ...products[0], index: i + 1 }));
        expect(buildNewsMessage('oX', many)!.articles.length).toBe(8);
    });
});

describe('buildTextListMessage', () => {
    test('numbered list fallback', () => {
        const msg = buildTextListMessage('oX', products);
        expect(msg.kind).toBe('text');
        expect(msg.content).toContain('1. 海天生抽酱油 500ml  ¥8.90');
        expect(msg.content).toContain('2. 金龙鱼大米 5kg  价格面议');
    });
});

describe('buildOrderSuccessText', () => {
    test('includes items, total, code and pay url', () => {
        const msg = buildOrderSuccessText('oX', {
            orderCode: 'ABCD12',
            total: 1780,
            items: [{ title: '海天生抽酱油 500ml', quantity: 2, price: 890 }],
            payUrl: 'https://shop.example.com/checkout/confirmation/ABCD12',
        });
        expect(msg.content).toContain('下单成功');
        expect(msg.content).toContain('海天生抽酱油 500ml ×2  ¥17.80');
        expect(msg.content).toContain('订单号：ABCD12');
        expect(msg.content).toContain('https://shop.example.com/checkout/confirmation/ABCD12');
    });
});

describe('buildInvalidOrderText', () => {
    test('guides to re-search', () => {
        const msg = buildInvalidOrderText('oX', [5]);
        expect(msg.content).toContain('「5」');
        expect(msg.content).toContain('重新发送');
    });
});

describe('绑定/补录文案', () => {
    test('绑定引导：回复手机号开通 + 登录链接兜底', () => {
        const msg = buildBindGuideText('oX', 'https://shop.example.com/account/login');
        expect(msg.content).toContain('未绑定');
        expect(msg.content).toContain('13800138000');
        expect(msg.content).toContain('https://shop.example.com/account/login');
        expect(msg.content).toContain('取消');
    });
    test('地址补录提示：回显手机号', () => {
        expect(buildAwaitingAddressText('oX', '13800138000').content).toContain('13800138000');
        expect(buildAwaitingAddressText('oX', '13800138000').content).toContain('收货地址');
    });
    test('防冒领文案：指向 H5 登录', () => {
        expect(buildPhoneTakenText('oX', 'https://shop.example.com/account/login').content).toContain(
            'https://shop.example.com/account/login',
        );
    });
});
