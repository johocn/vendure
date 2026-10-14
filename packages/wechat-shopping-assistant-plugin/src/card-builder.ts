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

/**
 * 绑定/补录引导（聊天内两步补录：手机号 → 收货地址；H5 登录页兜底）。
 * 触发点：用户回复「绑定」、未绑定用户回复编号下单、绑定手机号已被注册（防冒领回退）。
 */
export function buildBindGuideText(touser: string, loginUrl?: string): TextMessage {
    const lines = [
        '您还未绑定购物账号，回复手机号即可开通，如「13800138000」。',
        '开通后我会继续帮您完成下单。',
    ];
    if (loginUrl) lines.push(`也可以点链接在店铺内登录绑定：${loginUrl}`);
    lines.push('回复「取消」退出。');
    return { kind: 'text', touser, content: lines.join('\n') };
}

/** 收到手机号后，引导回复收货地址（第二步） */
export function buildAwaitingAddressText(touser: string, phone: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `手机号 ${phone} 已收到，再回复您的收货地址（含省市区 + 详细地址），如「北京市朝阳区xx路xx号」。\n回复「取消」退出。`,
    };
}

/** 状态机中回复无效手机号的重新提示 */
export function buildInvalidPhoneText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '手机号格式不对，请回复 11 位手机号，如「13800138000」。\n回复「取消」退出。',
    };
}

/** 地址过短，重新提示 */
export function buildInvalidAddressText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '地址好像不完整，请回复包含省/市/区的详细收货地址。\n回复「取消」退出。',
    };
}

/** 已取消补录 */
export function buildFlowCancelledText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '已取消。发送想买的商品（如「买一瓶酱油」）可继续购物。',
    };
}

/** 建档绑定成功但无待下单商品（直接发手机号/绑定开启的流程） */
export function buildBindSuccessText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '绑定成功！发送想买的商品（如「买一瓶酱油」），我来帮你下单～\n收货信息可在店铺「个人中心 → 地址簿」随时修改。',
    };
}

/** 绑定手机号已被注册 → 防冒领，回退 H5 登录验证 */
export function buildPhoneTakenText(touser: string, loginUrl?: string): TextMessage {
    const lines = [
        '该手机号已注册过店铺账号，为保护账号安全，请在微信内打开链接登录绑定：',
    ];
    if (loginUrl) lines.push(loginUrl);
    return { kind: 'text', touser, content: lines.join('\n') };
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
