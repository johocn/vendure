// e:\code\vendure\packages\customer-service-plugin\src\customer-service.service.ts
import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import {
    Logger,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { AfterSalesService, AfterSalesRequest } from '@vendure/after-sales-plugin';

const loggerCtx = 'CustomerServiceService';

/**
 * @description
 * 客服核心服务：全量订单查询、售后处理（代理 AfterSalesService）、异常订单跟进。
 *
 * 设计说明：
 * - findAllOrders 不过滤 staffId（客服可查全部订单），不过滤 active（含 Cancelled/Completed）
 * - 售后方法代理 AfterSalesService 的短名方法（approveRequest/rejectRequest/confirmReceive/processRefund）
 * - csNotes 为追加模式，不修改原有备注
 */
@Injectable()
export class CustomerServiceService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private afterSalesService: AfterSalesService,
    ) {}

    // ===== 订单查询 =====

    /**
     * 全量订单查询（无 staffId 过滤，支持 state/email/日期筛选 + 分页）
     */
    async findAllOrders(
        ctx: RequestContext,
        options?: {
            state?: string;
            customerEmail?: string;
            startDate?: string;
            endDate?: string;
            page?: number;
            pageSize?: number;
        },
    ): Promise<{ items: Order[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .orderBy('order.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        if (options?.customerEmail) {
            qb.andWhere('customer.emailAddress LIKE :email', {
                email: `%${options.customerEmail}%`,
            });
        }
        if (options?.startDate) {
            qb.andWhere('order.createdAt >= :start', { start: new Date(options.startDate) });
        }
        if (options?.endDate) {
            qb.andWhere('order.createdAt <= :end', { end: new Date(options.endDate) });
        }

        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    /**
     * 订单详情（聚合 order + 关联售后单 + 异常信息）
     */
    async findOrderDetail(
        ctx: RequestContext,
        orderId: ID,
    ): Promise<{
        order: Order;
        afterSalesRequests: AfterSalesRequest[];
        exceptionInfo: {
            deliveryStatus: string;
            exceptionType?: string | null;
            exceptionNote?: string | null;
            exceptionPhotos?: string[] | null;
            deliveryStaffId?: string | null;
        } | null;
    } | null> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'lines',
            'lines.productVariant',
            'fulfillments',
        ]);
        if (!order) return null;

        // 查该订单关联的售后单（直接查 AfterSalesRequest 实体）
        const afterSalesRepo = this.connection.rawConnection.getRepository(AfterSalesRequest);
        const afterSalesRequests = await afterSalesRepo.find({
            where: { orderId: orderId as any },
            relations: ['order', 'orderLine', 'customer'],
            order: { createdAt: 'DESC' },
        });

        // 异常信息（从 delivery customFields 读取）
        const cf = (order.customFields ?? {}) as any;
        const exceptionInfo =
            cf.deliveryStatus === 'exception'
                ? {
                      deliveryStatus: cf.deliveryStatus,
                      exceptionType: cf.exceptionType,
                      exceptionNote: cf.exceptionNote,
                      exceptionPhotos: cf.exceptionPhotos ?? [],
                      deliveryStaffId: cf.deliveryStaffId,
                  }
                : null;

        return { order, afterSalesRequests, exceptionInfo };
    }

    // ===== 售后处理（代理 AfterSalesService）=====
    // 注意：AfterSalesService 使用短方法名（非 GraphQL mutation 名）
    // GraphQL mutation 名: csApproveAfterSales / csRejectAfterSales / csConfirmReturnReceived / csProcessRefund
    // Service 方法名:      approveRequest / rejectRequest / confirmReceive / processRefund

    async approveAfterSales(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.afterSalesService.approveRequest(ctx, id);
    }

    async rejectAfterSales(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest> {
        return this.afterSalesService.rejectRequest(ctx, id, reason);
    }

    async confirmReturnReceived(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.afterSalesService.confirmReceive(ctx, id);
    }

    async processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.afterSalesService.processRefund(ctx, id);
    }

    /**
     * 售后单列表查询（直接查 AfterSalesRequest 实体，支持 state 筛选 + 分页）
     */
    async findAfterSalesRequests(
        ctx: RequestContext,
        options?: { state?: string; page?: number; pageSize?: number },
    ): Promise<{ items: AfterSalesRequest[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, AfterSalesRequest)
            .createQueryBuilder('request')
            .leftJoinAndSelect('request.order', 'order')
            .leftJoinAndSelect('request.orderLine', 'orderLine')
            .leftJoinAndSelect('request.customer', 'customer')
            .orderBy('request.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('request.state = :state', { state: options.state });
        }

        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneAfterSalesRequest(
        ctx: RequestContext,
        id: ID,
    ): Promise<AfterSalesRequest | undefined> {
        return this.afterSalesService.findOne(ctx, id);
    }

    // ===== 异常跟进 =====

    /**
     * 查询异常订单（customFields.deliveryStatus = 'exception'）
     */
    async findExceptionOrders(
        ctx: RequestContext,
        options?: { exceptionType?: string; page?: number; pageSize?: number },
    ): Promise<{
        items: Array<{
            order: Order;
            exceptionInfo: {
                deliveryStatus: string;
                exceptionType?: string | null;
                exceptionNote?: string | null;
                exceptionPhotos?: string[] | null;
                deliveryStaffId?: string | null;
            };
            csNotes: any[];
        }>;
        totalItems: number;
    }> {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.shippingAddress', 'shippingAddress')
            .where('order.customFields.deliveryStatus = :status', { status: 'exception' })
            .orderBy('order.createdAt', 'DESC');

        if (options?.exceptionType) {
            qb.andWhere('order.customFields.exceptionType = :type', {
                type: options.exceptionType,
            });
        }

        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [orders, totalItems] = await qb.getManyAndCount();

        const items = orders.map(order => {
            const cf = (order.customFields ?? {}) as any;
            return {
                order,
                exceptionInfo: {
                    deliveryStatus: cf.deliveryStatus,
                    exceptionType: cf.exceptionType,
                    exceptionNote: cf.exceptionNote,
                    exceptionPhotos: cf.exceptionPhotos ?? [],
                    deliveryStaffId: cf.deliveryStaffId,
                },
                csNotes: cf.csNotes ?? [],
            };
        });

        return { items, totalItems };
    }

    /**
     * 追加客服备注（不修改原有备注）
     */
    async addExceptionNote(ctx: RequestContext, orderId: ID, note: string): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new UserInputError(`Order ${orderId} not found`);
        }

        const existingNotes = ((order.customFields as any)?.csNotes ?? []) as any[];
        const newNote = {
            content: note,
            createdBy: String(ctx.activeUserId),
            createdAt: new Date(),
        };

        Logger.info(
            `CS note added to order ${order.code} by user ${ctx.activeUserId}`,
            loggerCtx,
        );

        return this.orderService.updateCustomFields(ctx, orderId, {
            csNotes: [...existingNotes, newNote],
        });
    }
}
