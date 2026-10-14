import { describe, expect, test } from 'vitest';
import {
    buildAddressListCard,
    buildAddrDeletedText,
    buildAddrNewPhoneText,
    buildAddrOpMenu,
    buildAwaitingAddressText,
    buildBindGuideText,
    buildInvalidOrderText,
    buildNewsMessage,
    buildOrderConfirmCard,
    buildOrderSuccessText,
    buildPhoneTakenText,
    buildTextListMessage,
    formatPrice,
    maskPhone,
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

describe('地址簿管理 + 下单选址（方案 B）', () => {
    const items = [
        { index: 1, fullName: '张三', phoneNumber: '13800138000', streetLine1: '北京市朝阳区建国路1号', isDefault: true },
        { index: 2, fullName: '', phoneNumber: '13999990000', streetLine1: '上海市浦东新区世纪大道100号', isDefault: false },
    ];

    test('maskPhone：前 3 后 4 打码，非 11 位原样', () => {
        expect(maskPhone('13800138000')).toBe('138****8000');
        expect(maskPhone('')).toBe('');
    });

    test('地址列表卡 order 模式：⭐ 标记 + 新增引导', () => {
        const msg = buildAddressListCard('oX', items, 'order');
        expect(msg.content).toContain('请选择收货地址：');
        expect(msg.content).toContain('1 ⭐ 张三 138****8000');
        expect(msg.content).toContain('收货人未填');
        expect(msg.content).toContain('回复编号选择地址下单，回复 0 新增地址');
    });

    test('地址列表卡 manage 模式 + 空态', () => {
        const msg = buildAddressListCard('oX', items, 'manage');
        expect(msg.content).toContain('您的地址簿（⭐ = 默认）');
        expect(msg.content).toContain('回复编号管理地址');
        const empty = buildAddressListCard('oX', [], 'order');
        expect(empty.content).toContain('您还没有收货地址');
        expect(empty.content).toContain('请直接回复收货地址');
    });

    test('操作菜单：设默认/修改/删除/返回', () => {
        const msg = buildAddrOpMenu('oX', items[0]);
        expect(msg.content).toContain('地址1：张三 138****8000 北京市朝阳区建国路1号 ⭐默认');
        expect(msg.content).toContain('回复 3 删除');
    });

    test('下单确认卡：商品明细 + 收货信息打码', () => {
        const msg = buildOrderConfirmCard('oX', {
            items: [{ title: '海天生抽酱油 500ml', quantity: 2, price: 890 }],
            total: 1780,
            address: { fullName: '张三', phoneNumber: '13800138000', streetLine1: '北京市朝阳区建国路1号', isDefault: true },
        });
        expect(msg.content).toContain('海天生抽酱油 500ml ×2  ¥17.80');
        expect(msg.content).toContain('合计：¥17.80');
        expect(msg.content).toContain('收货人：张三 ⭐');
        expect(msg.content).toContain('电话：138****8000');
        expect(msg.content).toContain('回复 1 确认下单，回复 0 重选地址');
    });

    test('删除成功文案三态：切默认 / 删光 / 非默认', () => {
        const switched = buildAddrDeletedText('oX', { index: 1, fullName: '张三', streetLine1: '北京市朝阳区建国路1号' });
        expect(switched.content).toContain('默认地址已自动切换为「张三 · 北京市朝阳区建国路1号」⭐');
        const empty = buildAddrDeletedText('oX', null);
        expect(empty.content).toContain('您目前没有默认地址');
        const plain = buildAddrDeletedText('oX');
        expect(plain.content).not.toContain('默认地址');
        expect(plain.content).toContain('已删除');
    });

    test('新增电话询问：有注册号问选择，无则直接要号码', () => {
        const withReg = buildAddrNewPhoneText('oX', '13800138000');
        expect(withReg.content).toContain('联系电话用注册手机号 138****8000 吗？');
        expect(withReg.content).toContain('回复 2 换新号码');
        const noReg = buildAddrNewPhoneText('oX');
        expect(noReg.content).toContain('请回复该地址的联系电话');
    });
});
