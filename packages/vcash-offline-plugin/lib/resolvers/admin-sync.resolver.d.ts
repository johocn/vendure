import { RequestContext } from '@vendure/core';
import { IncrementalSyncService } from '../services/incremental-sync.service';
import { SyncOrderService } from '../services/sync-order.service';
import { SyncPaymentService } from '../services/sync-payment.service';
import { SyncSessionService } from '../services/sync-session.service';
import { OfflineOrderRecord, OfflinePaymentSyncRecord, OfflineSessionRecord, SyncFailureResult, SyncedOrderResult, SyncedPaymentResult, SyncedSessionResult, SyncPaymentFailureResult, SyncSessionFailureResult } from '../types';
export declare class AdminSyncResolver {
    private syncOrderService;
    private syncPaymentService;
    private syncSessionService;
    private incrementalSyncService;
    constructor(syncOrderService: SyncOrderService, syncPaymentService: SyncPaymentService, syncSessionService: SyncSessionService, incrementalSyncService: IncrementalSyncService);
    syncOrders(input: {
        orders: OfflineOrderRecord[];
    }, ctx: RequestContext): Promise<{
        succeeded: SyncedOrderResult[];
        failed: SyncFailureResult[];
    }>;
    syncPayments(input: {
        payments: OfflinePaymentSyncRecord[];
    }, ctx: RequestContext): Promise<{
        succeeded: SyncedPaymentResult[];
        failed: SyncPaymentFailureResult[];
    }>;
    syncSessions(input: {
        sessions: OfflineSessionRecord[];
    }, ctx: RequestContext): Promise<{
        succeeded: SyncedSessionResult[];
        failed: SyncSessionFailureResult[];
    }>;
    syncProducts(since: Date, limit: number, ctx: RequestContext): Promise<import("../types").SyncProductsResult>;
    syncMembers(since: Date, limit: number, ctx: RequestContext): Promise<import("../types").SyncMembersResult>;
}
