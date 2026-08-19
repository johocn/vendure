import { ID, Injector, RequestContext, TransactionalConnection } from '@vendure/core';
import { LogisticsTrack } from './logistics-track.entity';
import { TrackResult } from './tracking-provider';
export interface BatchFulfillmentItem {
    orderId: ID;
    trackingNo: string;
    carrierCode: string;
    /** 拆单包号（如 P1/P2），回写到 Fulfillment.customFields.packageId */
    packageId?: string;
    /** 本包实际运费（分），回写到 Fulfillment.customFields.shippingFee */
    shippingFee?: number;
}
export interface BatchFulfillmentItemResult {
    orderId: ID;
    success: boolean;
    trackId: ID | null;
    error?: string;
}
export declare class LogisticsService {
    private connection;
    private orderService;
    private trackingProvider;
    constructor(connection: TransactionalConnection);
    init(injector: Injector): void;
    /**
     * 创建物流轨迹记录（绑定 fulfillment 与渠道）。
     */
    createTrack(ctx: RequestContext, fulfillmentId: ID, trackingNo: string, carrierCode: string): Promise<LogisticsTrack>;
    /**
     * 调用 Provider 查询物流轨迹，更新 entity。
     */
    queryTrack(ctx: RequestContext, trackId: ID): Promise<LogisticsTrack>;
    /**
     * 批量发货：为每个 order 创建 Fulfillment + LogisticsTrack。
     * Fulfillment customFields（trackingNumber/carrier/carrierCode）同步回写。
     */
    batchCreateFulfillment(ctx: RequestContext, items: BatchFulfillmentItem[]): Promise<BatchFulfillmentItemResult[]>;
    /**
     * 查询订单的物流轨迹（按 fulfillment 关联）。
     */
    getTracksByOrder(ctx: RequestContext, orderId: ID): Promise<LogisticsTrack[]>;
    /**
     * Shop 端查询订单物流轨迹：需校验订单归属（customerId 匹配）。
     */
    getMyOrderTracks(ctx: RequestContext, orderId: ID): Promise<LogisticsTrack[]>;
    /**
     * 接收第三方 webhook 回调，按 carrierCode + trackingNo 定位 track 并更新。
     */
    receiveCallback(ctx: RequestContext, carrierCode: string, trackingNo: string, trackResult: TrackResult): Promise<LogisticsTrack | null>;
    findOne(ctx: RequestContext, id: ID): Promise<LogisticsTrack | undefined>;
    findAll(ctx: RequestContext, options?: any): Promise<{
        items: LogisticsTrack[];
        totalItems: number;
    }>;
    /**
     * 回写 Fulfillment customFields。失败仅告警，不影响主流程。
     */
    private updateFulfillmentCustomFields;
}
