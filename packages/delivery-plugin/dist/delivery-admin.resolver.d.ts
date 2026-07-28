import { ID, Order, RequestContext } from '@vendure/core';
import { DeliveryService } from './delivery.service';
/**
 * @description
 * Admin API resolver：送货任务的查询与状态流转。
 *
 * 设计说明：
 * - `myDeliveries` 仅返回 `ctx.activeUserId` 名下的订单；`allDeliveries` 返回全部。
 * - 各 mutation 通过 `@Allow` 限制权限，service 内部再校验 ownership。
 * - 返回类型复用 Vendure 内置 `Order`，customFields 中的 delivery* 字段自动暴露。
 */
export declare class DeliveryAdminResolver {
    private deliveryService;
    constructor(deliveryService: DeliveryService);
    allDeliveries(ctx: RequestContext, status?: string): Promise<Order[]>;
    myDeliveries(ctx: RequestContext, status?: string): Promise<Order[]>;
    startDelivery(ctx: RequestContext, orderId: ID): Promise<Order>;
    markDelivered(ctx: RequestContext, orderId: ID, photos: string[], note?: string): Promise<Order>;
    reportException(ctx: RequestContext, orderId: ID, type: string, photos: string[], note?: string): Promise<Order>;
    reassignDelivery(ctx: RequestContext, orderId: ID, newStaffId: ID): Promise<Order>;
}
