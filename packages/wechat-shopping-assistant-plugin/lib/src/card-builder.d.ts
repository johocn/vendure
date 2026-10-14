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
/** 下单二次确认卡：商品明细 + 收货信息 */
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
}): TextMessage;
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
export {};
