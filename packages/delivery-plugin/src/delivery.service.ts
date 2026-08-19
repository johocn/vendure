import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import {
    ForbiddenError,
    Fulfillment,
    FulfillmentService,
    IllegalOperationError,
    Logger,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { DeliveryStatus, ExceptionType } from './constants';

const loggerCtx = 'DeliveryService';

/**
 * @description
 * 送货核心服务：负责送货任务的查询、状态流转与 Fulfillment 推进。
 *
 * 设计说明：
 * - `deliveryStaffId` 中存储的是 User ID（字符串），与 `ctx.activeUserId` 直接比较。
 * - 状态机：assigned → in_progress → delivered；任意状态可切到 exception。
 * - markDelivered 后将订单上 state=Shipped 的 Fulfillment 推进到 Delivered。
 * - withTransaction 内部必须使用回调的 txCtx，避免跨事务。
 */
@Injectable()
export class DeliveryService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private fulfillmentService: FulfillmentService,
    ) {}

    /**
     * 查询某送货员名下的订单。staffId 应为 User ID 字符串。
     * 仅返回 customFields.deliveryStatus 非空（即已被指派）的订单。
     */
    async findMyDeliveries(
        ctx: RequestContext,
        staffId: string,
        status?: string,
    ): Promise<Order[]> {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.shippingLines', 'shippingLines')
            .where('order.customFields.deliveryStaffId = :staffId', { staffId })
            .andWhere('order.customFields.deliveryStatus IS NOT NULL');

        if (status) {
            qb.andWhere('order.customFields.deliveryStatus = :status', { status });
        }
        qb.orderBy('order.createdAt', 'DESC');
        return qb.getMany();
    }

    /**
     * 管理员查询全部送货订单（任何已被指派的订单）。
     */
    async findAllDeliveries(ctx: RequestContext, status?: string): Promise<Order[]> {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.shippingLines', 'shippingLines')
            .where('order.customFields.deliveryStatus IS NOT NULL');

        if (status) {
            qb.andWhere('order.customFields.deliveryStatus = :status', { status });
        }
        qb.orderBy('order.createdAt', 'DESC');
        return qb.getMany();
    }

    /**
     * 开始配送：assigned → in_progress。
     * 仅订单的指派送货员可调用。
     */
    async startDelivery(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.getOrderOrThrow(ctx, orderId);
        this.assertOwnership(order, ctx);
        this.assertStatus(order, DeliveryStatus.Assigned, '开始配送');

        await this.orderService.updateCustomFields(ctx, orderId, {
            deliveryStatus: DeliveryStatus.InProgress,
        });
        Logger.info(`Order ${order.code} delivery started by staff ${ctx.activeUserId}`, loggerCtx);
        return this.reloadOrder(ctx, orderId);
    }

    /**
     * 送达签收：in_progress → delivered，并推进 Fulfillment Shipped → Delivered。
     */
    async markDelivered(
        ctx: RequestContext,
        orderId: ID,
        photos: string[],
        note?: string,
    ): Promise<Order> {
        if (!photos || photos.length === 0) {
            throw new UserInputError('At least one photo is required');
        }
        const order = await this.getOrderOrThrow(ctx, orderId);
        this.assertOwnership(order, ctx);
        this.assertStatus(order, DeliveryStatus.InProgress, '标记送达');

        await this.connection.withTransaction(ctx, async txCtx => {
            await this.orderService.updateCustomFields(txCtx, orderId, {
                deliveryStatus: DeliveryStatus.Delivered,
                deliveredAt: new Date(),
                deliveryPhotos: photos,
                deliveryNote: note ?? '',
            });

            // 推进 Shipped → Delivered（事务内）
            const orderWithFulfillments = await this.orderService.findOne(txCtx, orderId, [
                'fulfillments',
            ]);
            const fulfillments: Fulfillment[] = orderWithFulfillments?.fulfillments ?? [];
            for (const f of fulfillments) {
                if (f.state === 'Shipped') {
                    const result = await this.fulfillmentService.transitionToState(
                        txCtx,
                        f.id,
                        'Delivered',
                    );
                    if ('transitionError' in result) {
                        Logger.warn(
                            `Fulfillment ${f.id} transition to Delivered failed: ${result.transitionError}`,
                            loggerCtx,
                        );
                    }
                }
            }
        });

        Logger.info(`Order ${order.code} marked delivered by staff ${ctx.activeUserId}`, loggerCtx);
        return this.reloadOrder(ctx, orderId);
    }

    /**
     * 自提点核销（交付到点）：pickup 订单交付后确认已取货。
     *
     * 与 markDelivered（配送员签收）不同，自提场景无配送员指派链路，
     * 由店员/管理员在自提点交付后调用。校验：
     * - 订单为 pickup 类型（deliveryType === 'pickup'）且已选自提点
     * - 存在 Shipped 的 Fulfillment
     * 完成后：标记 pickupClaimed=true，并将所有 Shipped Fulfillment 推进到 Delivered。
     */
    async confirmPickupHandover(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const cf = (order.customFields ?? {}) as DeliveryCustomFields;
        if (cf.deliveryType !== 'pickup') {
            throw new IllegalOperationError(
                `Cannot confirm pickup handover: order deliveryType is "${cf.deliveryType ?? '(none)'}", expected "pickup"`,
            );
        }
        // relation 自定义字段（selectedPickupLocationId）不随 Order 实体加载（未设 eager），
        // 必须用 QueryBuilder 关联查询读取 FK 值（与 Vendure 官方 CustomFieldRelationResolverService 同法，跨库通用）
        const row = await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('o')
            .leftJoin('o.customFields.selectedPickupLocationId', 'pl')
            .select('pl.id', 'pickupLocationId')
            .where('o.id = :id', { id: orderId })
            .getRawOne();
        if (!row?.pickupLocationId) {
            throw new IllegalOperationError(
                'Cannot confirm pickup handover: no pickup location selected on order',
            );
        }

        await this.connection.withTransaction(ctx, async txCtx => {
            await this.orderService.updateCustomFields(txCtx, orderId, {
                pickupClaimed: true,
                deliveredAt: new Date(),
            });

            const orderWithFulfillments = await this.orderService.findOne(txCtx, orderId, [
                'fulfillments',
            ]);
            const fulfillments: Fulfillment[] = orderWithFulfillments?.fulfillments ?? [];
            let advanced = false;
            for (const f of fulfillments) {
                if (f.state === 'Shipped') {
                    const result = await this.fulfillmentService.transitionToState(
                        txCtx,
                        f.id,
                        'Delivered',
                    );
                    if ('transitionError' in result) {
                        Logger.warn(
                            `Fulfillment ${f.id} transition to Delivered failed: ${result.transitionError}`,
                            loggerCtx,
                        );
                    } else {
                        advanced = true;
                    }
                }
            }
            if (!advanced) {
                Logger.warn(
                    `confirmPickupHandover: order ${order.code} has no Shipped fulfillment to advance`,
                    loggerCtx,
                );
            }
        });

        Logger.info(
            `Order ${order.code} pickup handover confirmed by user ${ctx.activeUserId}`,
            loggerCtx,
        );
        return this.reloadOrder(ctx, orderId);
    }

    /**
     * 异常上报：写入异常字段并将状态置为 exception。
     * 不变更 Fulfillment 状态（保持 Shipped，待人工处理）。
     */
    async reportException(
        ctx: RequestContext,
        orderId: ID,
        type: string,
        photos: string[],
        note?: string,
    ): Promise<Order> {
        if (!Object.values(ExceptionType).includes(type as ExceptionType)) {
            throw new UserInputError(`Invalid exception type: ${type}`);
        }
        if (!photos || photos.length === 0) {
            throw new UserInputError('At least one photo is required');
        }
        const order = await this.getOrderOrThrow(ctx, orderId);
        this.assertOwnership(order, ctx);

        await this.orderService.updateCustomFields(ctx, orderId, {
            deliveryStatus: DeliveryStatus.Exception,
            exceptionType: type,
            exceptionPhotos: photos,
            exceptionNote: note ?? '',
        });
        Logger.info(
            `Order ${order.code} exception reported by staff ${ctx.activeUserId}: ${type}`,
            loggerCtx,
        );
        return this.reloadOrder(ctx, orderId);
    }

    /**
     * 改派：更换送货员并重置状态为 assigned。
     * 通常由 manager/super-admin 调用，不校验 ownership。
     */
    async reassignDelivery(
        ctx: RequestContext,
        orderId: ID,
        newStaffId: string,
    ): Promise<Order> {
        if (!newStaffId) {
            throw new UserInputError('newStaffId is required');
        }
        const order = await this.getOrderOrThrow(ctx, orderId);
        const cf = (order.customFields ?? {}) as DeliveryCustomFields;
        if (cf.deliveryStaffId === newStaffId) {
            throw new UserInputError('Order is already assigned to this staff');
        }

        await this.orderService.updateCustomFields(ctx, orderId, {
            deliveryStaffId: newStaffId,
            deliveryStatus: DeliveryStatus.Assigned,
            assignedAt: new Date(),
            deliveredAt: null,
            deliveryPhotos: [],
            deliveryNote: '',
            exceptionType: null,
            exceptionNote: '',
            exceptionPhotos: [],
        });
        Logger.info(
            `Order ${order.code} reassigned to staff ${newStaffId} by ${ctx.activeUserId}`,
            loggerCtx,
        );
        return this.reloadOrder(ctx, orderId);
    }

    // ===== Helpers =====

    private async getOrderOrThrow(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new UserInputError(`Order with id ${orderId} not found`);
        }
        return order;
    }

    private async reloadOrder(ctx: RequestContext, orderId: ID): Promise<Order> {
        const refreshed = await this.orderService.findOne(ctx, orderId, ['fulfillments']);
        if (!refreshed) {
            throw new UserInputError(`Order with id ${orderId} not found after update`);
        }
        return refreshed;
    }

    /**
     * 校验当前用户是指派送货员。deliveryStaffId 存储 User ID 字符串。
     */
    private assertOwnership(order: Order, ctx: RequestContext): void {
        const cf = (order.customFields ?? {}) as DeliveryCustomFields;
        const staffId = cf.deliveryStaffId;
        if (!ctx.activeUserId || !staffId || String(ctx.activeUserId) !== String(staffId)) {
            throw new ForbiddenError();
        }
    }

    private assertStatus(order: Order, expected: DeliveryStatus, action: string): void {
        const cf = (order.customFields ?? {}) as DeliveryCustomFields;
        const current = cf.deliveryStatus;
        if (current !== expected) {
            throw new IllegalOperationError(
                `Cannot ${action}: order delivery status is "${current}", expected "${expected}"`,
            );
        }
    }
}

/**
 * 插件扩展的 Order customFields 类型。
 * Vendure 内置 CustomOrderFields 不包含插件运行时注入的字段，需显式声明。
 */
interface DeliveryCustomFields {
    deliveryStaffId?: string | null;
    deliveryStatus?: string | null;
    assignedAt?: Date | null;
    deliveredAt?: Date | null;
    deliveryPhotos?: string[] | null;
    deliveryNote?: string | null;
    exceptionType?: string | null;
    exceptionNote?: string | null;
    exceptionPhotos?: string[] | null;
    // 自提相关（由 cjk-plugin 定义，此处仅类型声明）
    deliveryType?: string | null;
    pickupClaimed?: boolean | null;
}
