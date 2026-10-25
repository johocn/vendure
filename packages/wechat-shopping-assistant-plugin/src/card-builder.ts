import { CardProduct, NearbyStore, OutboundMessage } from './types';

type TextMessage = Extract<OutboundMessage, { kind: 'text' }>;
type NewsMessage = Extract<OutboundMessage, { kind: 'news' }>;

/** 价格分 → 展示串：890 → '8.90'，0 → '价格面议' */
export function formatPrice(price?: number): string {
    if (!price || price <= 0) return '价格面议';
    return `¥${(price / 100).toFixed(2)}`;
}

/** 一键客服提示行：异常/卡点消息统一附带（回复「客服」在任何状态下都生效） */
export const SUPPORT_HINT = '回复「客服」联系门店客服';

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
        content: `没有找到「${query}」相关的商品，换个说法试试？\n也可以回复「帮助」查看使用说明。\n${SUPPORT_HINT}`,
    };
}

export function buildSearchErrorText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `搜索服务开小差了，请稍后再试～\n${SUPPORT_HINT}`,
    };
}

export function buildGuideText(touser: string, storefrontUrl?: string): TextMessage {
    const lines = [
        '【购物助手使用指南】',
        '· 直接发送想买的商品，如「买一瓶酱油」',
        '· 回复商品编号下单，如「买1」「2」',
        '· 一次买多件：「买2瓶酱油」',
        '· 找附近门店：「附近门店」（需先发送位置）',
        '· 有问题随时回「客服」联系门店客服',
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
        content: `没有找到${indices.map(i => `「${i}」`).join('、')}对应的商品。\n最近一次搜索结果可能已过期，请重新发送想买的商品（如「买一瓶酱油」），再回复编号下单。\n${SUPPORT_HINT}`,
    };
}

export function buildOutOfStockText(touser: string, title: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `很抱歉，「${title}」库存不足，暂时无法下单。\n${SUPPORT_HINT}`,
    };
}

export function buildOrderFailText(touser: string, reason?: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `下单失败${reason ? `（${reason}）` : ''}，请稍后重试。\n${SUPPORT_HINT}`,
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
        content: `最近的搜索结果已过期，请重新发送想买的商品（如「买一瓶酱油」），再回复编号下单。\n${SUPPORT_HINT}`,
    };
}

// ============ 地址簿管理 + 下单选地址（方案 B 列表式逐轮问答） ============

/** 电话打码：137****2222；过短原样返回 */
export function maskPhone(phone?: string | null): string {
    const p = String(phone ?? '');
    return /^1\d{10}$/.test(p) ? `${p.slice(0, 3)}****${p.slice(7)}` : p;
}

/** 地址簿列表卡：⭐ 默认置顶标记；mode=order（下单选址）/ manage（地址管理） */
export function buildAddressListCard(
    touser: string,
    items: Array<{ index: number; fullName: string; phoneNumber: string; streetLine1: string; isDefault: boolean }>,
    mode: 'order' | 'manage',
): TextMessage {
    const listLines = items
        .map(
            a =>
                `${a.index}${a.isDefault ? ' ⭐' : ''} ${a.fullName || '收货人未填'} ${maskPhone(a.phoneNumber)}\n${a.streetLine1}`,
        )
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
export function buildAddrOpMenu(
    touser: string,
    item: { index: number; fullName: string; phoneNumber: string; streetLine1: string; isDefault: boolean },
): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `地址${item.index}：${item.fullName || '收货人未填'} ${maskPhone(item.phoneNumber)} ${item.streetLine1}${item.isDefault ? ' ⭐默认' : ''}\n要做什么？\n回复 1 设为默认\n回复 2 修改地址\n回复 3 删除\n回复 0 返回列表`,
    };
}

/** 下单二次确认卡：商品明细 + 收货信息 */
export function buildOrderConfirmCard(
    touser: string,
    input: {
        items: Array<{ title: string; quantity: number; price: number }>;
        total: number;
        address: { fullName: string; phoneNumber: string; streetLine1: string; isDefault: boolean };
    },
): TextMessage {
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
export function buildAddrEditFieldText(touser: string, index: number): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `修改地址${index}，要改哪项？\n回复 1 改收货地址\n回复 2 改收货人/电话`,
    };
}

/** 请回复新地址文本 */
export function buildAddrEditTextPrompt(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '请回复新的收货地址（含省市区 + 详细地址）：\n回复「取消」退出。',
    };
}

/** 请回复新收货人/电话（一行「姓名 电话」，姓名可省略） */
export function buildAddrEditPersonPrompt(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '请回复收货人和电话（一行，如「李四 13999990000」，只改电话可只发号码）：\n回复「取消」退出。',
    };
}

/** 删除确认 */
export function buildAddrDeleteConfirm(
    touser: string,
    item: { index: number; fullName: string; phoneNumber: string; streetLine1: string },
): TextMessage {
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
export function buildAddrDeletedText(
    touser: string,
    newDefault?: { index: number; fullName: string; streetLine1: string } | null,
): TextMessage {
    const lines = ['已删除 ✓'];
    if (newDefault) {
        lines.push(`默认地址已自动切换为「${newDefault.fullName || '收货人未填'} · ${newDefault.streetLine1}」⭐`);
    } else if (newDefault === null) {
        lines.push('您目前没有默认地址，可回复「新增」添加。');
    }
    lines.push('回复编号继续管理，回复「退出」结束');
    return { kind: 'text', touser, content: lines.join('\n') };
}

/** 新增地址：电话选择（默认用注册手机号） */
export function buildAddrNewPhoneText(touser: string, registeredPhone?: string): TextMessage {
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
export function buildAddrNewPhonePromptText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '请回复该地址的联系电话（11 位手机号）：\n回复「取消」退出。',
    };
}

/** 新增地址：是否设为默认 */
export function buildAddrNewDefaultText(touser: string, text: string, phone: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `已收到地址：${text}（${maskPhone(phone)}）\n设为默认地址？回复「是」/「否」`,
    };
}

/** 地址新增/修改成功展示卡 */
export function buildAddrSavedText(
    touser: string,
    item: { index: number; fullName: string; phoneNumber: string; streetLine1: string; isDefault: boolean },
): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `地址${item.index}${item.isDefault ? ' ⭐' : ''}：${item.fullName || '收货人未填'} ${maskPhone(item.phoneNumber)}\n${item.streetLine1}\n────────\n回复编号可继续管理，回复「退出」结束`,
    };
}

/** 管理态编号超范围/无效 */
export function buildInvalidAddrIndexText(touser: string, max: number): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `没有该编号的地址，请回复 1-${max} 之间的编号${max < 99 ? '，回复「新增」添加' : ''}。`,
    };
}

/** 收货人/电话格式错误 */
export function buildInvalidAddrPersonText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '格式不对，请回复「收货人 电话」（如「李四 13999990000」），或只回复 11 位手机号。',
    };
}

/** 已设为默认 */
export function buildAddrDefaultSetText(
    touser: string,
    item: { index: number; fullName: string; streetLine1: string },
): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `已将「${item.fullName || '收货人未填'} · ${item.streetLine1}」设为默认地址 ⭐\n回复编号可继续管理，回复「退出」结束`,
    };
}

// ============ 位置消息（微信发送位置） ============

/** 空闲态收到位置：识别成功并把地址缓存为「新增地址」的预填内容；有 3km 门店时一并列出 */
export function buildLocationRecognizedText(
    touser: string,
    addressText: string,
    stores: NearbyStore[] = [],
): TextMessage {
    const lines = [`已定位到：${addressText}`];
    if (stores.length) {
        lines.push(...formatStoreLines(stores));
        lines.push('回复「门店1」选用附近门店，或回复「新增地址」保存该位置为收货地址。');
    } else {
        lines.push('暂未匹配到 3km 内的门店，仍可正常下单配送。');
        lines.push('需要保存为收货地址时，回复「新增地址」即可直接使用这个位置。');
    }
    lines.push('也可以直接发送想买的商品（如「买一瓶酱油」）。');
    return { kind: 'text', touser, content: lines.join('\n') };
}

// ============ 城市识别 + 3km 门店匹配 ============

/** 门店列表行：序号 + 名称 + 熟店标记 + 距离 + 地址 */
function formatStoreLines(stores: NearbyStore[]): string[] {
    return [
        '3km 内门店（回复「门店N」选用）：',
        ...stores.map((store, i) => {
            const tag = store.familiar ? ' ⭐熟店' : '';
            const address = store.address ? `\n   ${store.address}` : '';
            return `${i + 1}. ${store.name}${tag}（${store.distanceKm.toFixed(1)}km）${address}`;
        }),
    ];
}

/** 「附近门店」：列出定位范围内的门店 */
export function buildNearbyStoresText(touser: string, stores: NearbyStore[], city?: string | null): TextMessage {
    const lines = [...(city ? [`当前城市：${city}`] : []), ...formatStoreLines(stores)];
    lines.push('回复「门店N」选用，回复「取消」结束。');
    return { kind: 'text', touser, content: lines.join('\n') };
}

/** 3km 内没有门店 */
export function buildNoNearbyStoresText(touser: string, city?: string | null): TextMessage {
    const scope = city ? `${city}附近 3km 内` : '3km 内';
    return {
        kind: 'text',
        touser,
        content: `${scope}暂未匹配到门店，仍可正常下单配送。\n发送想买的商品（如「买一瓶酱油」）即可继续。\n${SUPPORT_HINT}`,
    };
}

/** 未定位就查附近门店 */
export function buildStoreNeedLocationText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '还没有您的位置信息。请点聊天框「+」发送位置，我会自动识别城市并匹配 3km 内门店。',
    };
}

/** 门店编号无效 */
export function buildStoreSelectionInvalidText(touser: string, count: number): TextMessage {
    const range = count > 0 ? `1-${count}` : '对应编号';
    return {
        kind: 'text',
        touser,
        content: `没有找到该门店，请回复门店列表中的编号（${range}）。\n回复「取消」结束。`,
    };
}

/** 门店已选定 */
export function buildStoreSelectedText(touser: string, store: NearbyStore): TextMessage {
    const tag = store.familiar ? '（常去门店）' : '';
    return {
        kind: 'text',
        touser,
        content: [
            `已记住您的门店：${store.name}${tag}（${store.distanceKm.toFixed(1)}km）`,
            store.address ? `地址：${store.address}` : '',
            '可以继续发送想买的商品，下单会按该门店就近安排。',
        ]
            .filter(Boolean)
            .join('\n'),
    };
}

/** 地址操作流程中查门店：不打断当前流程 */
export function buildStoreFlowBusyText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '当前正在地址操作中，请先按提示完成或回复「取消」，再回复「附近门店」查看。',
    };
}

/** 非地址录入态收到位置：提示先完成当前操作，不打断流程 */
export function buildLocationFlowBusyText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '已收到位置。当前正在地址选择/操作中，请先按提示完成当前步骤。\n回复「取消」退出后，再发送位置即可保存为新地址。',
    };
}

/** 位置逆地理失败（地图服务不可用/无结果） */
export function buildLocationUnavailableText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '抱歉，暂时无法识别这个位置，请直接回复收货地址文本（含省市区 + 详细地址）。\n回复「客服」可联系门店客服协助。',
    };
}

/** 微信上报的经纬度不合法 */
export function buildLocationInvalidText(touser: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: '位置信息不完整，请重新发送位置，或直接回复收货地址文本（含省市区 + 详细地址）。',
    };
}

// ============ 一键客服（任何状态下回复「客服」生效，不打断原流程） ============

export interface SupportCardInput {
    /** 门店客服信息（已选门店/候选唯一时） */
    store?: { name: string; phoneNumber?: string | null; businessHours?: string | null } | null;
    /** 平台客服电话（门店未登记电话或未选门店时兜底） */
    platformPhone?: string | null;
    /** 当前这单的商品摘要（草稿中的下单商品） */
    items?: Array<{ title: string; quantity: number; price: number }>;
    /** 合计（分） */
    total?: number;
}

/**
 * 客服卡片（PRD FR-07）：门店名 + 电话 + 营业时间 + 当前订单上下文。
 * 门店电话缺失时回退平台客服电话；两者都没有时引导到店铺在线客服。
 */
export function buildSupportCard(touser: string, input: SupportCardInput): TextMessage {
    const lines: string[] = [];
    const store = input.store;
    const storePhone = String(store?.phoneNumber ?? '').trim();
    const platformPhone = String(input.platformPhone ?? '').trim();

    if (store) {
        lines.push(`${store.name} · 门店客服`);
        if (storePhone) {
            lines.push(`电话　${storePhone}（点击拨打）`);
        } else if (platformPhone) {
            lines.push(`门店电话暂未登记，可联系平台客服　${platformPhone}（点击拨打）`);
        } else {
            lines.push('门店电话暂未登记，可在店铺页联系在线客服。');
        }
        if (store.businessHours) lines.push(`营业　${store.businessHours}`);
    } else if (platformPhone) {
        lines.push('平台客服');
        lines.push(`电话　${platformPhone}（点击拨打）`);
    } else {
        lines.push('暂未配置客服电话，可在店铺页联系在线客服，或稍后再回「客服」试试。');
    }

    if (input.items?.length) {
        const summary = input.items.map(i => `${i.title} ×${i.quantity}`).join('，');
        const amount = input.total != null ? `，${formatPrice(input.total)}` : '';
        lines.push(`关于这单：${summary}${amount}`);
    }
    if (store || platformPhone) {
        lines.push('打电话时说明来自微信购物助手，客服可直接查这单。');
    }
    return { kind: 'text', touser, content: lines.join('\n') };
}

/** 有多个候选门店：让用户用「客服N」指定要联系哪家店 */
export function buildSupportStorePickText(touser: string, stores: NearbyStore[]): TextMessage {
    const lines = [
        '要联系哪家店？回复「客服N」选择：',
        ...stores.map((store, i) => `${i + 1}. ${store.name}${store.address ? `（${store.address}）` : ''}`),
    ];
    lines.push('回复「客服」查看可选门店。');
    return { kind: 'text', touser, content: lines.join('\n') };
}

/** 「客服N」编号无效 */
export function buildSupportInvalidStoreText(touser: string, count: number): TextMessage {
    const range = count > 0 ? `「客服1」到「客服${count}」` : '「客服」';
    return {
        kind: 'text',
        touser,
        content: `没有找到这家店，请回复${range}选择，或回复「客服」查看可选门店。`,
    };
}

/** 10 分钟内重复请求客服：只回短提示，不重复刷屏 */
export function buildSupportRepeatText(touser: string, input: { name?: string | null; phoneNumber?: string | null }): TextMessage {
    const name = input.name ? `${input.name} ` : '';
    const phone = input.phoneNumber ? `${input.phoneNumber} ` : '';
    return {
        kind: 'text',
        touser,
        content: `客服联系方式刚发过：${name}${phone}可直接拨打。\n若暂时没接通，稍后再回「客服」即可。`,
    };
}
