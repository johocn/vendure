import { CardProduct, OutboundMessage } from './types';
type TextMessage = Extract<OutboundMessage, {
    kind: 'text';
}>;
type NewsMessage = Extract<OutboundMessage, {
    kind: 'news';
}>;
/** 价格分 → 展示串：890 → '8.90'，0 → '价格面议' */
export declare function formatPrice(price?: number): string;
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
}): TextMessage;
export declare function buildWelcomeText(touser: string, storefrontUrl?: string): TextMessage;
export declare function buildSessionExpiredText(touser: string): TextMessage;
export {};
