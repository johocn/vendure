import { ID } from '@vendure/common/lib/shared-types';
import { FulfillmentService, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
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
export declare class DeliveryService {
    private connection;
    private orderService;
    private fulfillmentService;
    constructor(connection: TransactionalConnection, orderService: OrderService, fulfillmentService: FulfillmentService);
    /**
     * 查询某送货员名下的订单。staffId 应为 User ID 字符串。
     * 仅返回 customFields.deliveryStatus 非空（即已被指派）的订单。
     */
    findMyDeliveries(ctx: RequestContext, staffId: string, status?: string): Promise<Order[]>;
    /**
     * 管理员查询全部送货订单（任何已被指派的订单）。
     */
    findAllDeliveries(ctx: RequestContext, status?: string): Promise<Order[]>;
    /**
     * 开始配送：assigned → in_progress。
     * 仅订单的指派送货员可调用。
     */
    startDelivery(ctx: RequestContext, orderId: ID): Promise<Order>;
    /**
     * 送达签收：in_progress → delivered，并推进 Fulfillment Shipped → Delivered。
     */
    markDelivered(ctx: RequestContext, orderId: ID, photos: string[], note?: string): Promise<Order>;
    /**
     * 自提点核销（交付到点）：pickup 订单交付后确认已取货。
     *
     * 与 markDelivered（配送员签收）不同，自提场景无配送员指派链路，
     * 由店员/管理员在自提点交付后调用。校验：
     * - 订单为 pickup 类型（deliveryType === 'pickup'）且已选自提点
     * - 存在 Shipped 的 Fulfillment
     * 完成后：标记 pickupClaimed=true，并将所有 Shipped Fulfillment 推进到 Delivered。
     */
    confirmPickupHandover(ctx: RequestContext, orderId: ID): Promise<Order>;
    /**
     * 异常上报：写入异常字段并将状态置为 exception。
     * 不变更 Fulfillment 状态（保持 Shipped，待人工处理）。
     */
    reportException(ctx: RequestContext, orderId: ID, type: string, photos: string[], note?: string): Promise<Order>;
    /**
     * 改派：更换送货员并重置状态为 assigned。
     * 通常由 manager/super-admin 调用，不校验 ownership。
     */
    reassignDelivery(ctx: RequestContext, orderId: ID, newStaffId: string): Promise<Order>;
    private getOrderOrThrow;
    private reloadOrder;
    /**
     * 校验当前用户是指派送货员。deliveryStaffId 存储 User ID 字符串。
     */
    private assertOwnership;
    private assertStatus;
}
