import { CardProduct, NearbyStore, OutboundMessage } from './types';
type TextMessage = Extract<OutboundMessage, {
    kind: 'text';
}>;
type NewsMessage = Extract<OutboundMessage, {
    kind: 'news';
}>;
/** 价格分 → 展示串：890 → '8.90'，0 → '价格面议' */
export declare function formatPrice(price?: number): string;
/** 一键客服提示行：异常/卡点消息统一附带（回复「客服」在任何状态下都生效） */
export declare const SUPPORT_HINT = "\u56DE\u590D\u300C\u5BA2\u670D\u300D\u8054\u7CFB\u95E8\u5E97\u5BA2\u670D";
/** 图文卡片消息（方案 A）。商品数 0 返回 null；微信 news 上限 8 条 */
export declare function buildNewsMessage(touser: string, products: CardProduct[]): NewsMessage | null;
/** 纯文本编号列表（方案 B，news 发送失败/无图时兜底） */
export declare function buildTextListMessage(touser: string, products: CardProduct[]): TextMessage;
export declare function buildNoResultText(touser: string, query: string): TextMessage;
export declare function buildSearchErrorText(touser: string): TextMessage;
export declare function buildGuideText(touser: string, storefrontUrl?: string): TextMessage;
/**
 * 绑定/补录引导（聊天内两步补录：手机号 → 收货地址；H5 登录页兜底）。
 * 触发点：用户回复「绑定」、未绑定用户回复编号下单、绑定手机号已被注册（防冒领回退）。
 */
export declare function buildBindGuideText(touser: string, loginUrl?: string): TextMessage;
/** 收到手机号后，引导回复收货地址（第二步） */
export declare function buildAwaitingAddressText(touser: string, phone: string): TextMessage;
/** 状态机中回复无效手机号的重新提示 */
export declare function buildInvalidPhoneText(touser: string): TextMessage;
/** 地址过短，重新提示 */
export declare function buildInvalidAddressText(touser: string): TextMessage;
/** 已取消补录 */
export declare function buildFlowCancelledText(touser: string): TextMessage;
/** 建档绑定成功但无待下单商品（直接发手机号/绑定开启的流程） */
export declare function buildBindSuccessText(touser: string): TextMessage;
/** 绑定手机号已被注册 → 防冒领，回退 H5 登录验证 */
export declare function buildPhoneTakenText(touser: string, loginUrl?: string): TextMessage;
export declare function buildInvalidOrderText(touser: string, indices: number[]): TextMessage;
export declare function buildOutOfStockText(touser: string, title: string): TextMessage;
export declare function buildOrderFailText(touser: string, reason?: string): TextMessage;
export declare function buildOrderSuccessText(touser: string, input: {
    orderCode: string;
    total: number;
    items: Array<{
        title: string;
        quantity: number;
        price: number;
    }>;
    payUrl?: string;
    /** 确认时选定的支付方式展示名（渠道配置） */
    paymentName?: string;
    /** 门店预计送达分钟数（渠道配置），缺省时提示电话确认 */
    etaMinutes?: number | null;
}): TextMessage;
export declare function buildWelcomeText(touser: string, storefrontUrl?: string): TextMessage;
export declare function buildSessionExpiredText(touser: string): TextMessage;
/** 电话打码：137****2222；过短原样返回 */
export declare function maskPhone(phone?: string | null): string;
/** 地址簿列表卡：⭐ 默认置顶标记；mode=order（下单选址）/ manage（地址管理） */
export declare function buildAddressListCard(touser: string, items: Array<{
    index: number;
    fullName: string;
    phoneNumber: string;
    streetLine1: string;
    isDefault: boolean;
}>, mode: 'order' | 'manage'): TextMessage;
/** 管理态：选中地址的操作菜单 */
export declare function buildAddrOpMenu(touser: string, item: {
    index: number;
    fullName: string;
    phoneNumber: string;
    streetLine1: string;
    isDefault: boolean;
}): TextMessage;
/** 下单二次确认卡：商品明细 + 收货信息 + 支付方式（渠道配置） */
export declare function buildOrderConfirmCard(touser: string, input: {
    items: Array<{
        title: string;
        quantity: number;
        price: number;
    }>;
    total: number;
    address: {
        fullName: string;
        phoneNumber: string;
        streetLine1: string;
        isDefault: boolean;
    };
    payment?: {
        name: string;
        canSwitch?: boolean;
    };
    /** 门店预计送达分钟数（渠道配置），缺省时提示电话确认 */
    etaMinutes?: number | null;
}): TextMessage;
/** 未达起送价：拒绝建单并提示差额 */
export declare function buildMinOrderAmountText(touser: string, input: {
    total: number;
    minAmount: number;
}): TextMessage;
/** 选择支付方式：≥2 个可用时列出编号（0 返回重选地址） */
export declare function buildPaymentPickText(touser: string, methods: Array<{
    code: string;
    name: string;
}>, lead?: string): TextMessage;
/** 支付方式查询（未进入下单流程时列出，按渠道配置） */
export declare function buildPaymentMethodsInfoText(touser: string, methods: Array<{
    code: string;
    name: string;
}>): TextMessage;
/** 渠道未配置可用支付方式：不建单，引导联系门店 */
export declare function buildNoPaymentMethodText(touser: string): TextMessage;
/** 修改分支选择 */
export declare function buildAddrEditFieldText(touser: string, index: number): TextMessage;
/** 请回复新地址文本 */
export declare function buildAddrEditTextPrompt(touser: string): TextMessage;
/** 请回复新收货人/电话（一行「姓名 电话」，姓名可省略） */
export declare function buildAddrEditPersonPrompt(touser: string): TextMessage;
/** 删除确认 */
export declare function buildAddrDeleteConfirm(touser: string, item: {
    index: number;
    fullName: string;
    phoneNumber: string;
    streetLine1: string;
}): TextMessage;
/**
 * 删除成功。newDefault 三态：
 * - 传入对象：删的是默认地址且已自动切换 → 展示新默认；
 * - null：删的是默认地址且已删光 → 提示无默认可新增；
 * - undefined：删的不是默认地址 → 省略默认相关行。
 */
export declare function buildAddrDeletedText(touser: string, newDefault?: {
    index: number;
    fullName: string;
    streetLine1: string;
} | null): TextMessage;
/** 新增地址：电话选择（默认用注册手机号） */
export declare function buildAddrNewPhoneText(touser: string, registeredPhone?: string): TextMessage;
/** 新增地址：请回复新号码 */
export declare function buildAddrNewPhonePromptText(touser: string): TextMessage;
/** 新增地址：是否设为默认 */
export declare function buildAddrNewDefaultText(touser: string, text: string, phone: string): TextMessage;
/** 地址新增/修改成功展示卡 */
export declare function buildAddrSavedText(touser: string, item: {
    index: number;
    fullName: string;
    phoneNumber: string;
    streetLine1: string;
    isDefault: boolean;
}): TextMessage;
/** 管理态编号超范围/无效 */
export declare function buildInvalidAddrIndexText(touser: string, max: number): TextMessage;
/** 收货人/电话格式错误 */
export declare function buildInvalidAddrPersonText(touser: string): TextMessage;
/** 已设为默认 */
export declare function buildAddrDefaultSetText(touser: string, item: {
    index: number;
    fullName: string;
    streetLine1: string;
}): TextMessage;
/** 空闲态收到位置：识别成功并把地址缓存为「新增地址」的预填内容；有 3km 门店时一并列出 */
export declare function buildLocationRecognizedText(touser: string, addressText: string, stores?: NearbyStore[]): TextMessage;
/** 「附近门店」：列出定位范围内的门店 */
export declare function buildNearbyStoresText(touser: string, stores: NearbyStore[], city?: string | null): TextMessage;
/** 3km 内没有门店 */
export declare function buildNoNearbyStoresText(touser: string, city?: string | null): TextMessage;
/** 未定位就查附近门店 */
export declare function buildStoreNeedLocationText(touser: string): TextMessage;
/** 门店编号无效 */
export declare function buildStoreSelectionInvalidText(touser: string, count: number): TextMessage;
/** 门店已选定 */
export declare function buildStoreSelectedText(touser: string, store: NearbyStore): TextMessage;
/** 地址操作流程中查门店：不打断当前流程 */
export declare function buildStoreFlowBusyText(touser: string): TextMessage;
/** 非地址录入态收到位置：提示先完成当前操作，不打断流程 */
export declare function buildLocationFlowBusyText(touser: string): TextMessage;
/** 位置逆地理失败（地图服务不可用/无结果） */
export declare function buildLocationUnavailableText(touser: string): TextMessage;
/** 微信上报的经纬度不合法 */
export declare function buildLocationInvalidText(touser: string): TextMessage;
/** 客服微信号：同一会话第 3 次求助起提供，引导用户发语音说明问题 */
export declare const SUPPORT_WECHAT_ID = "youshopcn";
/** 第几次「客服」开始给微信号 */
export declare const SUPPORT_WECHAT_AFTER = 3;
export interface SupportCardInput {
    /** 门店客服信息（已选门店/候选唯一时） */
    store?: {
        name: string;
        phoneNumber?: string | null;
        businessHours?: string | null;
    } | null;
    /** 当前这单的商品摘要（草稿中的下单商品） */
    items?: Array<{
        title: string;
        quantity: number;
        price: number;
    }>;
    /** 合计（分） */
    total?: number;
    /** 店铺名（无门店时展示，避免只回一句「在线客服」） */
    shopName?: string | null;
    /** 店铺链接（可在店铺页查看订单） */
    shopUrl?: string | null;
    /** 客服微信号：仅第 3 次及以后求助时传入 */
    wechatId?: string | null;
}
/** 店铺信息卡：用户发店铺名/品牌名时的兜底，告诉主营、链接与可用指令 */
export declare function buildShopInfoCard(touser: string, input: {
    name: string;
    intro?: string | null;
    url?: string | null;
}): TextMessage;
/**
 * 客服卡片：先引导「在线留言」，不提供电话；第 3 次求助起附客服微信。
 */
export declare function buildSupportCard(touser: string, input: SupportCardInput): TextMessage;
/** 有多个候选门店：让用户用「客服N」指定要联系哪家店 */
export declare function buildSupportStorePickText(touser: string, stores: NearbyStore[], wechatId?: string | null): TextMessage;
/** 「客服N」编号无效 */
export declare function buildSupportInvalidStoreText(touser: string, count: number): TextMessage;
/** 10 分钟内重复请求客服：只回短提示，不重复刷屏（第 3 次起不再走此分支） */
export declare function buildSupportRepeatText(touser: string, input: {
    name?: string | null;
    wechatId?: string | null;
}): TextMessage;
/** 进入留言输入态 */
export declare function buildSupportNotePromptText(touser: string): TextMessage;
/** 留言超长 */
export declare function buildSupportNoteTooLongText(touser: string, length: number): TextMessage;
/** 留言已提交（工单编号便于后台/电话核对） */
export declare function buildSupportNoteSavedText(touser: string, ticketId: string): TextMessage;
/** 取消留言：恢复留言前的流程状态 */
export declare function buildSupportNoteCancelledText(touser: string): TextMessage;
/** 地址超出配送范围：说明原因 + 可服务区域 + 出口，不出现「下单失败」 */
export declare function buildOutOfRangeText(touser: string, input: {
    address: string;
    serviceAreaText: string;
    channelName?: string | null;
}): TextMessage;
/** 已切换到目标租户：提示价格已更新、需重新选编号 */
export declare function buildChannelSwitchText(touser: string, channelName: string): TextMessage;
/** 已切换到目标租户，但该店没有原关键词的商品：提示换词重搜（清空旧编号，避免误下到旧店） */
export declare function buildChannelSwitchNoMatchText(touser: string, channelName: string, query: string): TextMessage;
export {};
