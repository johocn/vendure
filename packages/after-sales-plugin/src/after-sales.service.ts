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
import { InventoryService } from '@vendure/inventory-plugin';

@Injectable()
export class AfterSalesService {
    private orderService: OrderService | null = null;
    private inventoryService: InventoryService | null = null;
    private options: AfterSalesPluginOptions = {};

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
        try {
            this.inventoryService = injector.get(InventoryService);
        } catch (e: any) {
            this.inventoryService = null;
            Logger.warn(`InventoryService 不可用，售后回补库存被禁用: ${e?.message ?? e}`, loggerCtx);
        }
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
            .andWhere('aftersalesrequest."customerId" = :customerId', { customerId: ctx.activeUserId })
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

        // 1. 校验订单存在且归属当前用户。
        // 注意：order.customer.id 是 Customer 主键，而 ctx.activeUserId 是关联 User 主键，两者不同。
        // 归属校验必须基于 customer.user.id 与 activeUserId 比较。
        let order;
        try {
            order = await this.orderService.findOne(ctx, input.orderId, ['customer', 'customer.user', 'lines'] as any);
        } catch (e: any) {
            throw e;
        }
        if (!order) {
            throw new UserInputError(`Order ${input.orderId} not found`);
        }
        const customerUserId = (order.customer as any)?.user?.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new ForbiddenError();
        }

        // 2. 校验订单状态（必须 Shipped/Delivered/PartialDelivery/Cancelled 才能售后）
        const allowedStates = ['Shipped', 'Delivered', 'PartiallyDelivered', 'Cancelled'];
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

        // 4.1 用解码后的实体 ID 存储外键：order.id / line.id 已是数据库内部数字 ID，
        // 不能直接用 GraphQL 编码 ID（T_1）写入 number 外键列，否则触发 FOREIGN KEY 约束失败。
        const entityOrderId = order.id;
        const entityOrderLineId = orderLine ? orderLine.id : null;

        // 5. 重复售后校验（同一 orderLineId 不能有未关闭的售后单）
        if (entityOrderLineId != null) {
            const repo = this.connection.getRepository(ctx, AfterSalesRequest);
            const existing = await repo.findOne({
                where: { orderLineId: entityOrderLineId as any, state: Not('Closed' as any) },
            });
            if (existing) {
                throw new UserInputError(`After-sales already exists for order line ${input.orderLineId}`);
            }
        }

        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = new AfterSalesRequest({
            orderId: entityOrderId as any,
            orderLineId: entityOrderLineId as any,
            type: (input.type as any) || 'return_refund',
            state: 'Pending',
            reason: input.reason,
            description: input.description || null,
            evidenceImages: input.evidenceImages || null,
            refundAmount: input.refundAmount,
            customerId: (order.customer as any).id as any,
        });
        request.channels = [ctx.channel];
        const saved = await repo.save(request);
        Logger.info(`After-sales request ${saved.id} created by customer ${ctx.activeUserId}`, loggerCtx);
        return this.hydrate(ctx, saved.id);
    }

    async cancelRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (request.state !== 'Pending') {
            throw new Error(`Cannot cancel request in state: ${request.state}`);
        }
        request.state = 'Closed';
        const saved = await repo.save(request);
        return this.hydrate(ctx, saved.id);
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
        const saved = await repo.save(request);
        return this.hydrate(ctx, saved.id);
    }

    /**
     * Mutation 保存后重新加载并返回带关系（order/orderLine）的实体。
     * 直接 repo.save() 返回的实体关系未加载，Shop SDL 中 `order: Order!` 非空字段会被自动关系解析取到 null，
     * 触发 "Cannot return null for non-nullable field AfterSalesRequest.order"。
     */
    private async hydrate(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const full = await repo.findOne({
            where: { id: id as any },
            relations: { order: true, orderLine: true, channels: true },
        });
        if (full) {
            return full;
        }
        throw new Error(`AfterSalesRequest #${id} not found after save`);
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

    /**
     * Returning → Received（收到退货）：
     * 在状态流转前先做库存回补——把收到的退货回补到原发货仓（orderLine.stockLocationId），
     * 同一事务内写 afterSales 账本，避免“退款了但库存不回来”。回补失败不影响收退货流程（告警）。
     * @param receivedQuantity 实收数量（部分退货按实收回补；缺省按订单行数量全额回补）
     */
    async confirmReceive(ctx: RequestContext, id: ID, receivedQuantity?: number): Promise<AfterSalesRequest> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, AfterSalesRequest);
            const request = await repo.findOne({
                where: { id: id as any },
                relations: ['orderLine'],
            });
            if (!request) throw new Error('Request not found');
            const allowed = STATE_TRANSITIONS[request.state];
            if (!allowed?.includes('Received')) {
                throw new Error(`Invalid transition: ${request.state} -> Received`);
            }

            // 实收数量：显式传入则记录；否则缺省为订单行数量（全额回补）
            const orderLine = request.orderLine;
            const orderedQty = orderLine ? Number(orderLine.quantity) || 0 : 0;
            if (receivedQuantity != null) {
                request.receivedQuantity = Math.max(0, Math.floor(receivedQuantity));
            }
            const recoverQty = Math.max(
                0,
                Math.min(
                    orderedQty,
                    request.receivedQuantity != null ? request.receivedQuantity : orderedQty,
                ),
            );

            // 库存回补：退货入库到原发货仓（仅当找到了原分配仓）
            if (orderLine && this.inventoryService) {
                const locationId = (orderLine.customFields as any)?.stockLocationId ?? null;
                if (locationId != null && recoverQty > 0) {
                    try {
                        await this.inventoryService.applyAfterSalesRestock(
                            txCtx,
                            (orderLine.productVariantId as any) as ID,
                            locationId as any,
                            recoverQty,
                            `AS${request.id}`,
                            (orderLine.id as any) as ID,
                        );
                        Logger.info(
                            `库存回补 loc#${locationId} qty=${recoverQty} for after-sales#${request.id}`,
                            loggerCtx,
                        );
                    } catch (e: any) {
                        // 回补失败不阻断收退货流程（仍可退款），仅告警便于运维追查
                        Logger.error(
                            `库存回补失败 after-sales#${request.id}: ${e?.message ?? e}`,
                            loggerCtx,
                        );
                    }
                } else if (recoverQty === 0) {
                    Logger.warn(`after-sales#${request.id} recoverQty=0，跳过库存回补`, loggerCtx);
                } else {
                    Logger.warn(
                        `after-sales#${request.id} 未找到原发货仓（orderLine.stockLocationId），跳过库存回补`,
                        loggerCtx,
                    );
                }
            }

            request.state = 'Received';
            return repo.save(request);
        });
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
