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
export declare function formatExceptions(exceptions: string[], overdue: string[]): string;
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
export declare function formatOrderStatus(o: OrderStatusInput): string;
