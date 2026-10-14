import { CardProduct, OutboundMessage } from './types';

type TextMessage = Extract<OutboundMessage, { kind: 'text' }>;
type NewsMessage = Extract<OutboundMessage, { kind: 'news' }>;

/** 价格分 → 展示串：890 → '8.90'，0 → '价格面议' */
export function formatPrice(price?: number): string {
    if (!price || price <= 0) return '价格面议';
    return `¥${(price / 100).toFixed(2)}`;
}

/** 图文卡片消息（方案 A）。商品数 0 返回 null；微信 news 上限 8 条 */
export function buildNewsMessage(touser: string, products: CardProduct[]): NewsMessage | null {
    if (!products.length) return null;
    return {
        kind: 'news',
        touser,
        articles: products.slice(0, 8).map(p => ({
            title: `${p.index}. ${p.title}`,
            description: `${formatPrice(p.price)}\n回复「${p.index}」立即下单`,
            url: p.url,
            picurl: p.thumbnail,
        })),
    };
}

/** 纯文本编号列表（方案 B，news 发送失败/无图时兜底） */
export function buildTextListMessage(touser: string, products: CardProduct[]): TextMessage {
    const lines = products.map(
        p => `${p.index}. ${p.title}  ${formatPrice(p.price)}\n回复「${p.index}」下单`,
    );
    return { kind: 'text', touser, content: ['为你找到以下商品：', ...lines].join('\n') };
}

export function buildNoResultText(touser: string, query: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `没有找到「${query}」相关的商品，换个说法试试？\n也可以回复「帮助」查看使用说明。`,
    };
}

export function buildSearchErrorText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '搜索服务开小差了，请稍后再试～',
    };
}

export function buildGuideText(touser: string, storefrontUrl?: string): TextMessage {
    const lines = [
        '【购物助手使用指南】',
        '· 直接发送想买的商品，如「买一瓶酱油」',
        '· 回复商品编号下单，如「买1」「2」',
        '· 一次买多件：「买2瓶酱油」',
        '· 下单成功后会收到订单与支付链接',
    ];
    if (storefrontUrl) lines.push(`· 进店逛逛：${storefrontUrl}`);
    return { kind: 'text', touser, content: lines.join('\n') };
}

export function buildBindGuideText(touser: string, loginUrl?: string): TextMessage {
    const base = '您还未绑定购物账号，下单前请先绑定：';
    if (!loginUrl) return { kind: 'text', touser, content: base + '\n请用微信打开店铺完成手机号登录。' };
    return {
        kind: 'text',
        touser,
        content: `${base}\n${loginUrl}\n（微信内打开，完成手机号验证后自动绑定，然后回复编号即可下单）`,
    };
}

export function buildInvalidOrderText(touser: string, indices: number[]): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `没有找到${indices.map(i => `「${i}」`).join('、')}对应的商品。\n最近一次搜索结果可能已过期，请重新发送想买的商品（如「买一瓶酱油」），再回复编号下单。`,
    };
}

export function buildOutOfStockText(touser: string, title: string): TextMessage {
    return { kind: 'text', touser, content: `很抱歉，「${title}」库存不足，暂时无法下单。` };
}

export function buildOrderFailText(touser: string, reason?: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `下单失败${reason ? `（${reason}）` : ''}，请稍后重试或联系客服。`,
    };
}

export function buildOrderSuccessText(
    touser: string,
    input: { orderCode: string; total: number; items: Array<{ title: string; quantity: number; price: number }>; payUrl?: string },
): TextMessage {
    const lines = ['下单成功！', ...input.items.map(i => `· ${i.title} ×${i.quantity}  ${formatPrice(i.price * i.quantity)}`)];
    lines.push(`合计：${formatPrice(input.total)}`);
    lines.push(`订单号：${input.orderCode}`);
    if (input.payUrl) lines.push(`点击支付：${input.payUrl}`);
    return { kind: 'text', touser, content: lines.join('\n') };
}

export function buildWelcomeText(touser: string, storefrontUrl?: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `欢迎光临！直接发送想买的商品（如「买一瓶酱油」），我来帮你找～\n回复「帮助」查看使用说明。`,
    };
}

export function buildSessionExpiredText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '最近的搜索结果已过期，请重新发送想买的商品（如「买一瓶酱油」），再回复编号下单。',
    };
}
