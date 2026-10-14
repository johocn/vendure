"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPrice = formatPrice;
exports.buildNewsMessage = buildNewsMessage;
exports.buildTextListMessage = buildTextListMessage;
exports.buildNoResultText = buildNoResultText;
exports.buildSearchErrorText = buildSearchErrorText;
exports.buildGuideText = buildGuideText;
exports.buildBindGuideText = buildBindGuideText;
exports.buildAwaitingAddressText = buildAwaitingAddressText;
exports.buildInvalidPhoneText = buildInvalidPhoneText;
exports.buildInvalidAddressText = buildInvalidAddressText;
exports.buildFlowCancelledText = buildFlowCancelledText;
exports.buildBindSuccessText = buildBindSuccessText;
exports.buildPhoneTakenText = buildPhoneTakenText;
exports.buildInvalidOrderText = buildInvalidOrderText;
exports.buildOutOfStockText = buildOutOfStockText;
exports.buildOrderFailText = buildOrderFailText;
exports.buildOrderSuccessText = buildOrderSuccessText;
exports.buildWelcomeText = buildWelcomeText;
exports.buildSessionExpiredText = buildSessionExpiredText;
exports.maskPhone = maskPhone;
exports.buildAddressListCard = buildAddressListCard;
exports.buildAddrOpMenu = buildAddrOpMenu;
exports.buildOrderConfirmCard = buildOrderConfirmCard;
exports.buildAddrEditFieldText = buildAddrEditFieldText;
exports.buildAddrEditTextPrompt = buildAddrEditTextPrompt;
exports.buildAddrEditPersonPrompt = buildAddrEditPersonPrompt;
exports.buildAddrDeleteConfirm = buildAddrDeleteConfirm;
exports.buildAddrDeletedText = buildAddrDeletedText;
exports.buildAddrNewPhoneText = buildAddrNewPhoneText;
exports.buildAddrNewPhonePromptText = buildAddrNewPhonePromptText;
exports.buildAddrNewDefaultText = buildAddrNewDefaultText;
exports.buildAddrSavedText = buildAddrSavedText;
exports.buildInvalidAddrIndexText = buildInvalidAddrIndexText;
exports.buildInvalidAddrPersonText = buildInvalidAddrPersonText;
exports.buildAddrDefaultSetText = buildAddrDefaultSetText;
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
/**
 * 绑定/补录引导（聊天内两步补录：手机号 → 收货地址；H5 登录页兜底）。
 * 触发点：用户回复「绑定」、未绑定用户回复编号下单、绑定手机号已被注册（防冒领回退）。
 */
function buildBindGuideText(touser, loginUrl) {
    const lines = [
        '您还未绑定购物账号，回复手机号即可开通，如「13800138000」。',
        '开通后我会继续帮您完成下单。',
    ];
    if (loginUrl)
        lines.push(`也可以点链接在店铺内登录绑定：${loginUrl}`);
    lines.push('回复「取消」退出。');
    return { kind: 'text', touser, content: lines.join('\n') };
}
/** 收到手机号后，引导回复收货地址（第二步） */
function buildAwaitingAddressText(touser, phone) {
    return {
        kind: 'text',
        touser,
        content: `手机号 ${phone} 已收到，再回复您的收货地址（含省市区 + 详细地址），如「北京市朝阳区xx路xx号」。\n回复「取消」退出。`,
    };
}
/** 状态机中回复无效手机号的重新提示 */
function buildInvalidPhoneText(touser) {
    return {
        kind: 'text',
        touser,
        content: '手机号格式不对，请回复 11 位手机号，如「13800138000」。\n回复「取消」退出。',
    };
}
/** 地址过短，重新提示 */
function buildInvalidAddressText(touser) {
    return {
        kind: 'text',
        touser,
        content: '地址好像不完整，请回复包含省/市/区的详细收货地址。\n回复「取消」退出。',
    };
}
/** 已取消补录 */
function buildFlowCancelledText(touser) {
    return {
        kind: 'text',
        touser,
        content: '已取消。发送想买的商品（如「买一瓶酱油」）可继续购物。',
    };
}
/** 建档绑定成功但无待下单商品（直接发手机号/绑定开启的流程） */
function buildBindSuccessText(touser) {
    return {
        kind: 'text',
        touser,
        content: '绑定成功！发送想买的商品（如「买一瓶酱油」），我来帮你下单～\n收货信息可在店铺「个人中心 → 地址簿」随时修改。',
    };
}
/** 绑定手机号已被注册 → 防冒领，回退 H5 登录验证 */
function buildPhoneTakenText(touser, loginUrl) {
    const lines = [
        '该手机号已注册过店铺账号，为保护账号安全，请在微信内打开链接登录绑定：',
    ];
    if (loginUrl)
        lines.push(loginUrl);
    return { kind: 'text', touser, content: lines.join('\n') };
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
// ============ 地址簿管理 + 下单选地址（方案 B 列表式逐轮问答） ============
/** 电话打码：137****2222；过短原样返回 */
function maskPhone(phone) {
    const p = String(phone !== null && phone !== void 0 ? phone : '');
    return /^1\d{10}$/.test(p) ? `${p.slice(0, 3)}****${p.slice(7)}` : p;
}
/** 地址簿列表卡：⭐ 默认置顶标记；mode=order（下单选址）/ manage（地址管理） */
function buildAddressListCard(touser, items, mode) {
    const listLines = items
        .map(a => `${a.index}${a.isDefault ? ' ⭐' : ''} ${a.fullName || '收货人未填'} ${maskPhone(a.phoneNumber)}\n${a.streetLine1}`)
        .join('\n');
    if (mode === 'order') {
        return {
            kind: 'text',
            touser,
            content: `请选择收货地址：\n${listLines || '您还没有收货地址'}\n────────\n回复编号选择地址下单${items.length ? '，回复 0 新增地址' : '，请直接回复收货地址（含省市区 + 详细）'}`,
        };
    }
    return {
        kind: 'text',
        touser,
        content: `您的地址簿（⭐ = 默认）：\n${listLines || '您还没有收货地址'}\n────────\n回复编号管理地址，回复「新增」添加${items.length ? '' : '（请直接回复收货地址）'}，回复「退出」结束`,
    };
}
/** 管理态：选中地址的操作菜单 */
function buildAddrOpMenu(touser, item) {
    return {
        kind: 'text',
        touser,
        content: `地址${item.index}：${item.fullName || '收货人未填'} ${maskPhone(item.phoneNumber)} ${item.streetLine1}${item.isDefault ? ' ⭐默认' : ''}\n要做什么？\n回复 1 设为默认\n回复 2 修改地址\n回复 3 删除\n回复 0 返回列表`,
    };
}
/** 下单二次确认卡：商品明细 + 收货信息 */
function buildOrderConfirmCard(touser, input) {
    const lines = input.items.map(i => `${i.title} ×${i.quantity}  ${formatPrice(i.price * i.quantity)}`);
    lines.push(`合计：${formatPrice(input.total)}`);
    lines.push('────────');
    lines.push(`收货人：${input.address.fullName || '收货人未填'}${input.address.isDefault ? ' ⭐' : ''}`);
    lines.push(`电话：${maskPhone(input.address.phoneNumber)}`);
    lines.push(`地址：${input.address.streetLine1}`);
    lines.push('────────');
    lines.push('回复 1 确认下单，回复 0 重选地址');
    return { kind: 'text', touser, content: lines.join('\n') };
}
/** 修改分支选择 */
function buildAddrEditFieldText(touser, index) {
    return {
        kind: 'text',
        touser,
        content: `修改地址${index}，要改哪项？\n回复 1 改收货地址\n回复 2 改收货人/电话`,
    };
}
/** 请回复新地址文本 */
function buildAddrEditTextPrompt(touser) {
    return {
        kind: 'text',
        touser,
        content: '请回复新的收货地址（含省市区 + 详细地址）：\n回复「取消」退出。',
    };
}
/** 请回复新收货人/电话（一行「姓名 电话」，姓名可省略） */
function buildAddrEditPersonPrompt(touser) {
    return {
        kind: 'text',
        touser,
        content: '请回复收货人和电话（一行，如「李四 13999990000」，只改电话可只发号码）：\n回复「取消」退出。',
    };
}
/** 删除确认 */
function buildAddrDeleteConfirm(touser, item) {
    return {
        kind: 'text',
        touser,
        content: `确认删除地址${item.index}？\n${item.fullName || '收货人未填'} ${maskPhone(item.phoneNumber)} ${item.streetLine1}\n────────\n回复 1 确认删除\n回复 0 返回`,
    };
}
/**
 * 删除成功。newDefault 三态：
 * - 传入对象：删的是默认地址且已自动切换 → 展示新默认；
 * - null：删的是默认地址且已删光 → 提示无默认可新增；
 * - undefined：删的不是默认地址 → 省略默认相关行。
 */
function buildAddrDeletedText(touser, newDefault) {
    const lines = ['已删除 ✓'];
    if (newDefault) {
        lines.push(`默认地址已自动切换为「${newDefault.fullName || '收货人未填'} · ${newDefault.streetLine1}」⭐`);
    }
    else if (newDefault === null) {
        lines.push('您目前没有默认地址，可回复「新增」添加。');
    }
    lines.push('回复编号继续管理，回复「退出」结束');
    return { kind: 'text', touser, content: lines.join('\n') };
}
/** 新增地址：电话选择（默认用注册手机号） */
function buildAddrNewPhoneText(touser, registeredPhone) {
    if (registeredPhone) {
        return {
            kind: 'text',
            touser,
            content: `联系电话用注册手机号 ${maskPhone(registeredPhone)} 吗？\n回复 1 用这个号码\n回复 2 换新号码\n回复「取消」退出。`,
        };
    }
    return {
        kind: 'text',
        touser,
        content: '请回复该地址的联系电话（11 位手机号）：\n回复「取消」退出。',
    };
}
/** 新增地址：请回复新号码 */
function buildAddrNewPhonePromptText(touser) {
    return {
        kind: 'text',
        touser,
        content: '请回复该地址的联系电话（11 位手机号）：\n回复「取消」退出。',
    };
}
/** 新增地址：是否设为默认 */
function buildAddrNewDefaultText(touser, text, phone) {
    return {
        kind: 'text',
        touser,
        content: `已收到地址：${text}（${maskPhone(phone)}）\n设为默认地址？回复「是」/「否」`,
    };
}
/** 地址新增/修改成功展示卡 */
function buildAddrSavedText(touser, item) {
    return {
        kind: 'text',
        touser,
        content: `地址${item.index}${item.isDefault ? ' ⭐' : ''}：${item.fullName || '收货人未填'} ${maskPhone(item.phoneNumber)}\n${item.streetLine1}\n────────\n回复编号可继续管理，回复「退出」结束`,
    };
}
/** 管理态编号超范围/无效 */
function buildInvalidAddrIndexText(touser, max) {
    return {
        kind: 'text',
        touser,
        content: `没有该编号的地址，请回复 1-${max} 之间的编号${max < 99 ? '，回复「新增」添加' : ''}。`,
    };
}
/** 收货人/电话格式错误 */
function buildInvalidAddrPersonText(touser) {
    return {
        kind: 'text',
        touser,
        content: '格式不对，请回复「收货人 电话」（如「李四 13999990000」），或只回复 11 位手机号。',
    };
}
/** 已设为默认 */
function buildAddrDefaultSetText(touser, item) {
    return {
        kind: 'text',
        touser,
        content: `已将「${item.fullName || '收货人未填'} · ${item.streetLine1}」设为默认地址 ⭐\n回复编号可继续管理，回复「退出」结束`,
    };
}
//# sourceMappingURL=card-builder.js.map