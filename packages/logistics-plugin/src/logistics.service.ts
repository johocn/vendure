import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import {
    EntityNotFoundError,
    ForbiddenError,
    ID,
    Injector,
    Logger,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
    Fulfillment,
} from '@vendure/core';

import { loggerCtx, LOGISTICS_PLUGIN_OPTIONS } from './constants';
import { LogisticsTrack } from './logistics-track.entity';
import { getCarrierByCode } from './carrier-dictionary';
import { LogisticsPluginOptions } from './types';
import { LogisticsTrackingProvider, NoopTrackingProvider, TrackResult } from './tracking-provider';
import { OrderPackageService } from './order-package.service';

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

const MANUAL_FULFILLMENT_HANDLER_CODE = 'manual-fulfillment';

@Injectable()
export class LogisticsService {
    private orderService: OrderService | null = null;
    private trackingProvider: LogisticsTrackingProvider = new NoopTrackingProvider();
    private orderPackageService: OrderPackageService | null = null;

    constructor(private connection: TransactionalConnection) {}

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
        try {
            const options = injector.get<LogisticsPluginOptions>(LOGISTICS_PLUGIN_OPTIONS as any);
            this.trackingProvider = options?.trackingProvider ?? new NoopTrackingProvider();
        } catch {
            this.trackingProvider = new NoopTrackingProvider();
        }
        try {
            this.orderPackageService = injector.get(OrderPackageService);
        } catch {
            this.orderPackageService = null;
        }
    }

    /**
     * 创建物流轨迹记录（绑定 fulfillment 与渠道）。
     */
    async createTrack(
        ctx: RequestContext,
        fulfillmentId: ID,
        trackingNo: string,
        carrierCode: string,
    ): Promise<LogisticsTrack> {
        if (!getCarrierByCode(carrierCode)) {
            throw new UserInputError(`Unknown carrierCode: ${carrierCode}`);
        }
        const repo = this.connection.getRepository(ctx, LogisticsTrack);
        const track = new LogisticsTrack({
            fulfillmentId: fulfillmentId as any,
            trackingNo,
            carrierCode,
            status: 'unknown',
        });
        track.channelId = ctx.channelId as any;
        track.channels = [ctx.channel];
        const saved = await repo.save(track);
        Logger.info(`LogisticsTrack ${saved.id} created for fulfillment ${fulfillmentId}`, loggerCtx);
        return saved;
    }

    /**
     * 调用 Provider 查询物流轨迹，更新 entity。
     */
    async queryTrack(ctx: RequestContext, trackId: ID): Promise<LogisticsTrack> {
        const repo = this.connection.getRepository(ctx, LogisticsTrack);
        const track = await repo.findOne({ where: { id: trackId as any } });
        if (!track) {
            throw new EntityNotFoundError('LogisticsTrack', trackId);
        }
        try {
            const result = await this.trackingProvider.queryTrack(ctx, track.carrierCode, track.trackingNo);
            track.status = result.status;
            track.trackInfo = JSON.stringify(result.tracks);
            track.signedAt = result.signedAt ?? undefined;
            track.lastSyncedAt = new Date();
            track.lastError = null;
            await repo.save(track);
        } catch (e: any) {
            track.lastError = e.message;
            track.lastSyncedAt = new Date();
            await repo.save(track);
            Logger.error(`Query track failed for ${trackId}: ${e.message}`, loggerCtx);
        }
        return track;
    }

    /**
     * 批量发货：为每个 order 创建 Fulfillment + LogisticsTrack。
     * Fulfillment customFields（trackingNumber/carrier/carrierCode）同步回写。
     */
    async batchCreateFulfillment(
        ctx: RequestContext,
        items: BatchFulfillmentItem[],
    ): Promise<BatchFulfillmentItemResult[]> {
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const results: BatchFulfillmentItemResult[] = [];
        for (const item of items) {
            try {
                const carrierDef = getCarrierByCode(item.carrierCode);
                if (!carrierDef) {
                    throw new UserInputError(`Unknown carrierCode: ${item.carrierCode}`);
                }
                const order = await this.orderService.findOne(ctx, item.orderId, ['lines']);
                if (!order) {
                    throw new UserInputError(`Order ${item.orderId} not found`);
                }
                const lines = order.lines.map(l => ({ orderLineId: l.id, quantity: l.quantity }));
                if (lines.length === 0) {
                    throw new UserInputError(`Order ${item.orderId} has no lines`);
                }

                // 1. 调用 orderService.createFulfillment 创建发货记录
                const fulfillmentResult = await this.orderService.createFulfillment(ctx, {
                    lines,
                    handler: {
                        code: MANUAL_FULFILLMENT_HANDLER_CODE,
                        arguments: [
                            { name: 'method', value: carrierDef.name },
                            { name: 'trackingCode', value: item.trackingNo },
                        ],
                    },
                });
                if (isFulfillmentError(fulfillmentResult)) {
                    throw new Error(`Fulfillment error: ${(fulfillmentResult as any).message ?? 'unknown'}`);
                }
                const fulfillment = fulfillmentResult as Fulfillment;

                // 2. 回写 Fulfillment customFields（carrierCode/carrier/trackingNumber + 拆单包号/本包运费）
                await this.updateFulfillmentCustomFields(ctx, fulfillment.id, {
                    trackingNumber: item.trackingNo,
                    carrier: carrierDef.name,
                    carrierCode: item.carrierCode,
                    ...(item.packageId != null ? { packageId: item.packageId } : {}),
                    ...(item.shippingFee != null ? { shippingFee: item.shippingFee } : {}),
                });

                // 挂钩点2：按包回填 OrderPackage.fulfillmentId + 实际运费（未命中仅告警，不阻断发货）
                if (item.packageId) {
                    try {
                        await this.orderPackageService?.linkFulfillment(
                            ctx,
                            item.orderId,
                            item.packageId,
                            fulfillment.id,
                            item.shippingFee ?? null,
                        );
                        // 挂钩点2b：发货成功 → OrderPackage pending→shipped（幂等；失败仅告警，不阻断发货）
                        await this.orderPackageService?.transition(ctx, item.orderId, item.packageId, 'shipped');
                    } catch (e: any) {
                        Logger.warn(
                            `OrderPackage 回填发货失败 order#${item.orderId} pkg=${item.packageId}: ${e?.message ?? e}`,
                            loggerCtx,
                        );
                    }
                }

                // 3. 创建 LogisticsTrack 记录
                const track = await this.createTrack(ctx, fulfillment.id, item.trackingNo, item.carrierCode);
                results.push({ orderId: item.orderId, success: true, trackId: track.id });
            } catch (e: any) {
                results.push({
                    orderId: item.orderId,
                    success: false,
                    trackId: null,
                    error: e.message,
                });
            }
        }
        return results;
    }

    /**
     * 查询订单的物流轨迹（按 fulfillment 关联）。
     */
    async getTracksByOrder(ctx: RequestContext, orderId: ID): Promise<LogisticsTrack[]> {
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const order = await this.orderService.findOne(ctx, orderId, ['fulfillments']);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        const fulfillmentIds = (order.fulfillments ?? []).map(f => f.id);
        if (fulfillmentIds.length === 0) {
            return [];
        }
        const repo = this.connection.getRepository(ctx, LogisticsTrack);
        return repo.find({
            where: { fulfillmentId: In(fulfillmentIds as any) },
            order: { updatedAt: 'DESC' as any },
        });
    }

    /**
     * Shop 端查询订单物流轨迹：需校验订单归属（customerId 匹配）。
     */
    async getMyOrderTracks(ctx: RequestContext, orderId: ID): Promise<LogisticsTrack[]> {
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'fulfillments']);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        if (!order.customer || String(order.customer.id) !== String(ctx.activeUserId)) {
            throw new ForbiddenError();
        }
        const fulfillmentIds = (order.fulfillments ?? []).map(f => f.id);
        if (fulfillmentIds.length === 0) {
            return [];
        }
        const repo = this.connection.getRepository(ctx, LogisticsTrack);
        return repo.find({
            where: { fulfillmentId: In(fulfillmentIds as any) },
            order: { updatedAt: 'DESC' as any },
        });
    }

    /**
     * 接收第三方 webhook 回调，按 carrierCode + trackingNo 定位 track 并更新。
     */
    async receiveCallback(
        ctx: RequestContext,
        carrierCode: string,
        trackingNo: string,
        trackResult: TrackResult,
    ): Promise<LogisticsTrack | null> {
        const repo = this.connection.getRepository(ctx, LogisticsTrack);
        const track = await repo.findOne({
            where: { carrierCode, trackingNo },
        });
        if (!track) {
            Logger.warn(`Callback received for unknown track: ${carrierCode}/${trackingNo}`, loggerCtx);
            return null;
        }
        track.status = trackResult.status;
        track.trackInfo = JSON.stringify(trackResult.tracks);
        track.signedAt = trackResult.signedAt ?? undefined;
        track.lastSyncedAt = new Date();
        track.lastError = null;
        return repo.save(track);
    }

    async findOne(ctx: RequestContext, id: ID): Promise<LogisticsTrack | undefined> {
        const repo = this.connection.getRepository(ctx, LogisticsTrack);
        const result = await repo.findOne({ where: { id: id as any } });
        return result ?? undefined;
    }

    async findAll(ctx: RequestContext, options?: any): Promise<{ items: LogisticsTrack[]; totalItems: number }> {
        const repo = this.connection.getRepository(ctx, LogisticsTrack);
        const [items, totalItems] = await repo.findAndCount({
            where: { channelId: ctx.channelId as any },
            order: { updatedAt: 'DESC' as any },
            skip: options?.skip ?? 0,
            take: options?.take ?? 50,
        });
        return { items, totalItems };
    }

    /**
     * 回写 Fulfillment customFields。失败仅告警，不影响主流程。
     */
    private async updateFulfillmentCustomFields(
        ctx: RequestContext,
        fulfillmentId: ID,
        values: Record<string, any>,
    ): Promise<void> {
        try {
            const repo = this.connection.getRepository(ctx, Fulfillment);
            const fulfillment = await repo.findOne({ where: { id: fulfillmentId as any } });
            if (!fulfillment) return;
            fulfillment.customFields = {
                ...(fulfillment.customFields ?? {}),
                ...values,
            };
            await repo.save(fulfillment);
        } catch (e: any) {
            Logger.warn(`Failed to update fulfillment customFields: ${e.message}`, loggerCtx);
        }
    }
}

/**
 * 判断 createFulfillment 返回是否为错误结果。
 */
function isFulfillmentError(result: any): boolean {
    if (!result) return true;
    if (typeof result !== 'object') return false;
    // ErrorResult 都带 errorCode
    return 'errorCode' in result;
}
