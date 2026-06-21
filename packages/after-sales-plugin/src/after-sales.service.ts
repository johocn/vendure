import { Injectable } from '@nestjs/common';
import {
    ID,
    Injector,
    ListQueryBuilder,
    ListQueryOptions,
    OrderService,
    PaginatedList,
    RequestContext,
    Logger,
    TransactionalConnection,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesState, STATE_TRANSITIONS } from './types';

@Injectable()
export class AfterSalesService {
    private orderService: OrderService | null = null;

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
    }

    async findOne(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id as any },
            relations: { order: true, orderLine: true, customer: true, channels: true },
        });
        return result ?? undefined;
    }

    async findMyRequests(
        ctx: RequestContext,
        options?: ListQueryOptions<AfterSalesRequest>,
    ): Promise<PaginatedList<AfterSalesRequest>> {
        return this.listQueryBuilder
            .build(AfterSalesRequest, options, {
                ctx,
                relations: ['order', 'orderLine', 'channels'],
                channelId: ctx.channelId,
            })
            .andWhere('afterSalesRequest.customerId = :customerId', { customerId: ctx.activeUserId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<AfterSalesRequest>,
    ): Promise<PaginatedList<AfterSalesRequest>> {
        return this.listQueryBuilder
            .build(AfterSalesRequest, options, {
                ctx,
                relations: ['order', 'orderLine', 'customer', 'channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async createRequest(ctx: RequestContext, input: {
        orderId: ID;
        orderLineId?: ID;
        type: string;
        reason: string;
        description?: string;
        evidenceImages?: string[];
        refundAmount: number;
    }): Promise<AfterSalesRequest> {
        if (!ctx.activeUserId) {
            throw new Error('Must be logged in to create an after-sales request');
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = new AfterSalesRequest({
            orderId: input.orderId as any,
            orderLineId: (input.orderLineId as any) || null,
            type: (input.type as any) || 'return_refund',
            state: 'Pending',
            reason: input.reason,
            description: input.description || null,
            evidenceImages: input.evidenceImages || null,
            refundAmount: input.refundAmount,
            customerId: ctx.activeUserId as any,
        });
        request.channels = [ctx.channel];
        const saved = await repo.save(request);
        Logger.info(`After-sales request ${saved.id} created by customer ${ctx.activeUserId}`, loggerCtx);
        return saved;
    }

    async cancelRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (request.state !== 'Pending') {
            throw new Error(`Cannot cancel request in state: ${request.state}`);
        }
        request.state = 'Closed';
        return repo.save(request);
    }

    async updateReturnTracking(ctx: RequestContext, id: ID, trackingNo: string, carrier: string): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (request.state !== 'Approved') {
            throw new Error(`Cannot update tracking in state: ${request.state}`);
        }
        request.returnTrackingNo = trackingNo;
        request.returnCarrier = carrier;
        request.state = 'Returning';
        return repo.save(request);
    }

    // ===== Admin Operations =====

    async approveRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.transitionState(ctx, id, 'Approved');
    }

    async rejectRequest(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (!STATE_TRANSITIONS[request.state]?.includes('Rejected')) {
            throw new Error(`Cannot reject from state: ${request.state}`);
        }
        request.state = 'Rejected';
        request.rejectReason = reason;
        return repo.save(request);
    }

    async confirmReceive(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.transitionState(ctx, id, 'Received');
    }

    async processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const request = await this.transitionState(ctx, id, 'Refunded');
        // Trigger actual refund via OrderService
        if (this.orderService) {
            try {
                await this.orderService.refundOrder(ctx, {
                    lines: request.orderLineId
                        ? [{ orderLineId: request.orderLineId as any, quantity: 1 }]
                        : [],
                    shipping: 0,
                    adjustment: 0,
                    paymentId: (request.order as any)?.payments?.[0]?.id,
                    reason: `After-sales refund #${request.id}`,
                } as any);
                Logger.info(`Refund processed for after-sales request ${request.id}`, loggerCtx);
            } catch (e: any) {
                Logger.error(`Refund failed for after-sales request ${request.id}: ${e.message}`, loggerCtx);
            }
        }
        return request;
    }

    private async transitionState(ctx: RequestContext, id: ID, toState: AfterSalesState): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        const allowed = STATE_TRANSITIONS[request.state];
        if (!allowed?.includes(toState)) {
            throw new Error(`Invalid transition: ${request.state} -> ${toState}`);
        }
        request.state = toState;
        return repo.save(request);
    }
}
