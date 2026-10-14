"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPrice = formatPrice;
exports.buildNewsMessage = buildNewsMessage;
exports.buildTextListMessage = buildTextListMessage;
exports.buildNoResultText = buildNoResultText;
exports.buildSearchErrorText = buildSearchErrorText;
exports.buildGuideText = buildGuideText;
exports.buildBindGuideText = buildBindGuideText;
exports.buildInvalidOrderText = buildInvalidOrderText;
exports.buildOutOfStockText = buildOutOfStockText;
exports.buildOrderFailText = buildOrderFailText;
exports.buildOrderSuccessText = buildOrderSuccessText;
exports.buildWelcomeText = buildWelcomeText;
exports.buildSessionExpiredText = buildSessionExpiredText;
/** 价格分 → 展示串：890 → '8.90'，0 → '价格面议' */
function formatPrice(price) {
    if (!price || price <= 0)
        return '价格面议';
    return `¥${(price / 100).toFixed(2)}`;
}
/** 图文卡片消息（方案 A）。商品数 0 返回 null；微信 news 上限 8 条 */
function buildNewsMessage(touser, products) {
    if (!products.length)
        return null;
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
function buildTextListMessage(touser, products) {
    const lines = products.map(p => `${p.index}. ${p.title}  ${formatPrice(p.price)}\n回复「${p.index}」下单`);
    return { kind: 'text', touser, content: ['为你找到以下商品：', ...lines].join('\n') };
}
function buildNoResultText(touser, query) {
    return {
        kind: 'text',
        touser,
        content: `没有找到「${query}」相关的商品，换个说法试试？\n也可以回复「帮助」查看使用说明。`,
    };
}
function buildSearchErrorText(touser) {
    return {
        kind: 'text',
        touser,
        content: '搜索服务开小差了，请稍后再试～',
    };
}
function buildGuideText(touser, storefrontUrl) {
    const lines = [
        '【购物助手使用指南】',
        '· 直接发送想买的商品，如「买一瓶酱油」',
        '· 回复商品编号下单，如「买1」「2」',
        '· 一次买多件：「买2瓶酱油」',
        '· 下单成功后会收到订单与支付链接',
    ];
    if (storefrontUrl)
        lines.push(`· 进店逛逛：${storefrontUrl}`);
    return { kind: 'text', touser, content: lines.join('\n') };
}
function buildBindGuideText(touser, loginUrl) {
    const base = '您还未绑定购物账号，下单前请先绑定：';
    if (!loginUrl)
        return { kind: 'text', touser, content: base + '\n请用微信打开店铺完成手机号登录。' };
    return {
        kind: 'text',
        touser,
        content: `${base}\n${loginUrl}\n（微信内打开，手机号验证码登录即自动绑定）\n绑定后可在「个人中心 → 地址簿」维护电话与收货地址，然后回复编号即可下单。`,
    };
}
function buildInvalidOrderText(touser, indices) {
    return {
        kind: 'text',
        touser,
        content: `没有找到${indices.map(i => `「${i}」`).join('、')}对应的商品。\n最近一次搜索结果可能已过期，请重新发送想买的商品（如「买一瓶酱油」），再回复编号下单。`,
    };
}
function buildOutOfStockText(touser, title) {
    return { kind: 'text', touser, content: `很抱歉，「${title}」库存不足，暂时无法下单。` };
}
function buildOrderFailText(touser, reason) {
    return {
        kind: 'text',
        touser,
        content: `下单失败${reason ? `（${reason}）` : ''}，请稍后重试或联系客服。`,
    };
}
function buildOrderSuccessText(touser, input) {
    const lines = ['下单成功！', ...input.items.map(i => `· ${i.title} ×${i.quantity}  ${formatPrice(i.price * i.quantity)}`)];
    lines.push(`合计：${formatPrice(input.total)}`);
    lines.push(`订单号：${input.orderCode}`);
    if (input.payUrl)
        lines.push(`点击支付：${input.payUrl}`);
    return { kind: 'text', touser, content: lines.join('\n') };
}
function buildWelcomeText(touser, storefrontUrl) {
    return {
        kind: 'text',
        touser,
        content: `欢迎光临！直接发送想买的商品（如「买一瓶酱油」），我来帮你找～\n回复「帮助」查看使用说明。`,
    };
}
function buildSessionExpiredText(touser) {
    return {
        kind: 'text',
        touser,
        content: '最近的搜索结果已过期，请重新发送想买的商品（如「买一瓶酱油」），再回复编号下单。',
    };
}
//# sourceMappingURL=card-builder.js.map