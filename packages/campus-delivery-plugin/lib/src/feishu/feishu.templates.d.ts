/** 飞书消息文案（纯函数，便于单测；不含 emoji，保持运维群阅读清爽） */
export interface PushInput {
    scene: string;
    title: string;
    content: string;
    orderCode?: string;
    link?: string;
    at?: number;
}
export declare function formatPush(input: PushInput): string;
export declare function formatDateTime(at: number): string;
export declare const HELP_TEXT: string;
export interface BoardLike {
    paused: boolean;
    storeName?: string;
    pending: Array<{
        code?: string;
    }>;
    cooking: Array<{
        code?: string;
    }>;
    awaitingRider: Array<{
        code?: string;
    }>;
    delivering: Array<{
        code?: string;
    }>;
    pendingDispatch?: Array<{
        code?: string;
    }>;
    thirdParty?: Array<{
        code?: string;
    }>;
    completedToday: number;
    completedTodayAmount: number;
}
export declare function formatBoard(board: BoardLike): string;
export interface DigestInput extends BoardLike {
    date: string;
    totalOrders: number;
    onTimeRate: number;
    cancelled: number;
    exceptionCount: number;
}
export declare function formatDigest(d: DigestInput): string;
export interface PlatformStoreLine {
    name: string;
    paused: boolean;
    pending: number;
    pendingCodes: string[];
    cooking: number;
    awaitingRider: number;
    delivering: number;
    pendingDispatch: number;
    thirdParty: number;
    ownedPool: number;
    ownedDispatched: number;
    merchantDelivering: number;
    completedToday: number;
    completedTodayAmount: number;
    exceptionCount: number;
}
export declare function formatPlatformBoard(input: {
    stores: PlatformStoreLine[];
    exceptions: string[];
    overdue: string[];
    at: number;
}): string;
export declare function formatExceptions(exceptions: string[], overdue: string[], soonOverdue?: string[]): string;
export interface PlatformDigestStore {
    name: string;
    completed: number;
    amount: number;
    onTimeRate: number;
    cancelled: number;
    exception: number;
}
export declare function formatPlatformDigest(input: {
    date: string;
    stores: PlatformDigestStore[];
    totalOrders: number;
    cancelled: number;
    completed: number;
    amount: number;
    onTimeRate: number;
    exception: number;
}): string;
export interface OrderStatusInput {
    code: string;
    store: string;
    orderState: string;
    hallStatus?: string | null;
    deliveryStatus?: string | null;
    route?: string | null;
    riderName?: string | null;
    building?: string | null;
    zone?: string | null;
    slotText?: string | null;
    total?: number;
    exceptionType?: string | null;
    exceptionNote?: string | null;
    exceptionMinutes?: number | null;
    createdAt: number;
    at: number;
}
export declare function orderHallLabel(status?: string | null): string;
export declare function orderDeliveryLabel(status?: string | null): string | null;
export declare function formatOrderStatus(o: OrderStatusInput): string;
/** 展示用短码：去掉非字母数字后取尾 4 位；完整单号始终在按钮 value / 引用回读中 */
export declare function shortCode(code: string): string;
export declare function buildOrderCard(o: OrderStatusInput): Record<string, unknown>;
export interface SearchRow {
    code: string;
    store: string;
    hallStatus?: string | null;
    building?: string | null;
    createdAt: number;
}
/** 模糊检索结果卡片：每行一个候选订单，按钮 value 里带完整单号 */
export declare function buildSearchCard(query: string, rows: SearchRow[]): Record<string, unknown>;
export interface ReplyTemplate {
    id: string;
    label: string;
    aliases: string[];
    text: string;
}
export declare const REPLY_TEMPLATES: ReplyTemplate[];
/** 引用订单卡片时，整段文本命中模板名/别名则视为快捷回复 */
export declare function matchReplyTemplate(raw: string): ReplyTemplate | undefined;
export declare function replyTemplateText(tpl: ReplyTemplate, code: string): string;
/** 快捷回复卡片：按钮 value 带完整单号与模板 id */
export declare function buildTemplateCard(code: string): Record<string, unknown>;
/** 从卡片 JSON（按钮 value）里取完整单号 */
export declare function extractOrderCodeFromCard(content?: string): string | undefined;
/** 从被引用的纯文本消息里兜底提取单号（形如「订单 A1234…」） */
export declare function extractOrderCodeFromText(text?: string): string | undefined;
