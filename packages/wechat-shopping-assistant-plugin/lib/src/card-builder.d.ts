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
export declare function buildBindGuideText(touser: string, loginUrl?: string): TextMessage;
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
