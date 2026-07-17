import { Injectable } from '@nestjs/common';
import { Not } from 'typeorm';
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
    EntityNotFoundError,
    UserInputError,
    ForbiddenError,
    UnauthorizedError,
} from '@vendure/core';

import { loggerCtx, AFTER_SALES_PLUGIN_OPTIONS } from './constants';
import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesState, AfterSalesPluginOptions, STATE_TRANSITIONS } from './types';

@Injectable()
export class AfterSalesService {
    private orderService: OrderService | null = null;
    private options: AfterSalesPluginOptions = {};

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
        try {
            this.options = injector.get<AfterSalesPluginOptions>(AFTER_SALES_PLUGIN_OPTIONS as any) ?? {};
        } catch {
            this.options = {};
        }
    }

    async findOne(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id as any },
            relations: { order: true, orderLine: true, customer: true, channels: true },
        });
        return result ?? undefined;
    }

    /**
     * Shop API 专用：按 customerId 过滤，防止越权枚举他人售后单。
     */
    async findOneForCustomer(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined> {
        const customerId = ctx.activeUserId;
        if (!customerId) {
            throw new UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id as any, customerId: customerId as any },
            relations: { order: true, orderLine: true, channels: true },
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
            throw new UnauthorizedError();
        }
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }

        // 1. 校验订单存在且归属当前用户
        const order = await this.orderService.findOne(ctx, input.orderId, ['customer', 'lines']);
        if (!order) {
            throw new UserInputError(`Order ${input.orderId} not found`);
        }
        if (!order.customer || String(order.customer.id) !== String(ctx.activeUserId)) {
            throw new ForbiddenError();
        }

        // 2. 校验订单状态（必须 Shipped/Delivered/PartialDelivery/Cancelled 才能售后）
        const allowedStates = ['Shipped', 'Delivered', 'PartialDelivery', 'Cancelled'];
        if (!allowedStates.includes(order.state)) {
            throw new UserInputError(
                `Cannot create after-sales: order state must be one of ${allowedStates.join('/')}, got ${order.state}`,
            );
        }

        // 3. 售后期窗口校验（默认 7 天无理由 + 15 天质量问题 = 22 天上限）
        const maxDays = this.options?.maxDaysAfterDelivery ?? 7;
        const orderDate = order.updatedAt || order.createdAt;
        const daysSince = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > maxDays + 15) {
            throw new UserInputError(`Cannot create after-sales: exceeded ${maxDays + 15} days limit`);
        }

        // 4. 退款金额上限校验
        const orderLine = input.orderLineId
            ? order.lines.find(l => String(l.id) === String(input.orderLineId))
            : null;
        if (input.orderLineId && !orderLine) {
            throw new UserInputError(`Order line ${input.orderLineId} not found in order ${input.orderId}`);
        }
        const maxRefund = orderLine
            ? orderLine.proratedLinePrice
            : (order.totalQuantity > 0 ? order.total : 0);
        if (input.refundAmount > maxRefund) {
            throw new UserInputError(`Refund amount ${input.refundAmount} exceeds max ${maxRefund}`);
        }

        // 5. 重复售后校验（同一 orderLineId 不能有未关闭的售后单）
        if (input.orderLineId) {
            const repo = this.connection.getRepository(ctx, AfterSalesRequest);
            const existing = await repo.findOne({
                where: { orderLineId: input.orderLineId as any, state: Not('Closed' as any) },
            });
            if (existing) {
                throw new UserInputError(`After-sales already exists for order line ${input.orderLineId}`);
            }
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
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({
            where: { id: id as any },
            relations: ['order', 'order.payments'] as any,
        });
        if (!request) {
            throw new EntityNotFoundError('AfterSalesRequest', id);
        }
        if (request.state !== 'Received') {
            throw new UserInputError('Cannot refund: request must be in Received state');
        }

        const payments = (request.order as any)?.payments as Array<{ id: ID }> | undefined;
        if (!payments || payments.length === 0) {
            throw new UserInputError(`Cannot refund: no payment found for order ${request.orderId}`);
        }
        const paymentId = payments[0].id;

        // 事务包裹：退款成功后才改状态，避免“已退款但实际未退”脏数据
        await this.connection.startTransaction(ctx);
        try {
            // 1. 先调用 refundOrder（实际退款）
            await this.orderService.refundOrder(ctx, {
                paymentId,
                amount: request.refundAmount,
                reason: `After-sales refund #${request.id}`,
            } as any);
            Logger.info(`Refund processed for after-sales request ${request.id}`, loggerCtx);

            // 2. 退款成功后才改状态
            request.state = 'Refunded';
            await repo.save(request);

            // 3. 回写 Order customFields.afterSalesStatus
            await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'Refunded');

            await this.connection.commitOpenTransaction(ctx);
        } catch (e: any) {
            await this.connection.rollBackTransaction(ctx);
            Logger.error(`Refund failed for after-sales #${id}: ${e.message}`, loggerCtx);
            throw e;
        }
        return request;
    }

    /**
     * 回写 Order customFields.afterSalesStatus。失败仅告警，不影响主流程。
     */
    private async updateOrderAfterSalesStatus(ctx: RequestContext, orderId: ID, status: string): Promise<void> {
        if (!this.orderService) return;
        try {
            await this.orderService.updateCustomFields(ctx, orderId, { afterSalesStatus: status });
        } catch (e: any) {
            Logger.warn(`Failed to update order afterSalesStatus: ${e.message}`, loggerCtx);
        }
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
