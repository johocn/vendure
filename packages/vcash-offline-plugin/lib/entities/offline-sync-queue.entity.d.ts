export declare class OfflineSyncQueue {
    id: number;
    idempotencyKey: string;
    type: 'order' | 'payment' | 'session';
    payload: any;
    clientCreatedAt: Date;
    clientUpdatedAt: Date;
    status: string;
    syncedOrderId?: number;
    syncedOrderCode?: string;
    syncError?: {
        code: string;
        message: string;
    } | null;
    retryCount: number;
    syncedAt?: Date;
    sessionCode?: string;
}
