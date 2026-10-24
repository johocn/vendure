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
