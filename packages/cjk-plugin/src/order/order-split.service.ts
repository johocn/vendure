import { Injectable } from '@nestjs/common';
import { ID, Order, OrderService, RequestContext, UserInputError, isGraphQlErrorResult } from '@vendure/core';
import { OrderBoxService } from './order-box.service';
import { AggregationBox, decideAggregation } from './order-box-aggregation';

/**
 * 后端「一次性拆单」服务（Path B 非余额拆多单）。
 *
 * 语义：源活动订单内所有 box 在一个 Order（AddingItems 态）。用户选定非余额支付方式 M 时，
 * 聚合引擎（decideAggregation）返回 groups[]；groups 头 1 组保留在源订单，其余各组各建新订单，
 * 并把对应箱的订单行从源订单迁移到新订单，最后逐单过渡到 ArrangingPayment 并 addPaymentToOrder。
 *
 * 设计约束：
 * - 由调用方 mutation 保证 @Transaction() 整体原子；任一步失败整体回滚。
 * - 订单行迁移采用「源订单 removeItemsFromOrder + 新订单 addItemsToOrder」按 variant+qty 重建，
 *   箱划分依据为变体级 shippingProfileId，重加后分箱结果一致；行级 customFields 不随迁。
 * - 每单配送方式沿用源订单的箱选择快照，缺失时用该箱默认配送方式兜底。
 */
@Injectable()
export class OrderSplitService {
    constructor(
        private orderService: OrderService,
        private orderBoxService: OrderBoxService,
    ) {}

    /**
     * 一次性拆单并逐单完成支付，返回需各自结算的订单列表（均已付款结算）。
     *
     * @param order 源活动订单（含全部 box 的 lines）
     * @param method 所选支付方式 code（同时驱动聚合判定）
     * @param metadata 支付方式透传 metadata
     */
    async performSplitCheckout(
        ctx: RequestContext,
        order: Order,
        method: string,
        metadata?: Record<string, any>,
    ): Promise<Order[]> {
        // 显式带 lines.productVariant 重新加载，保证分箱与行迁移数据准确
        const source = (await this.orderService.findOne(ctx, order.id, ['lines.productVariant', 'customer'])) as Order;
        if (!source) throw new UserInputError('NO_ACTIVE_ORDER');

        const boxes = await this.orderBoxService.computeOrderBoxes(ctx, source);
        if (boxes.length === 0) throw new UserInputError('NO_BOXES');

        const aggBoxes: AggregationBox[] = boxes.map(b => ({
            boxKey: b.boxKey,
            profileId: String(b.profileId),
            tenantChannelId: String(b.tenantChannelId),
            availablePaymentMethodCodes: b.availablePaymentMethodCodes,
        }));
        const { groups } = decideAggregation({ boxes: aggBoxes, userSelectedPaymentMethod: method });
        if (groups.length === 0) throw new UserInputError('NO_AGGREGATION_GROUP');

        const boxByKey = new Map(boxes.map(b => [b.boxKey, b]));
        const selections = this.orderBoxService.getBoxSelections(source);

        // 每行 variantId+qty 快照（迁移用）
        const lineInfo = new Map<string, { variantId: string; qty: number }>();
        for (const line of source.lines ?? []) {
            const vid = (line as any).productVariantId ?? (line as any).productVariant?.id;
            if (vid == null) continue;
            lineInfo.set(String(line.id), { variantId: String(vid), qty: (line as any).quantity ?? 0 });
        }

        // 需要迁移到新订单的箱 = groups[1..n]
        const moveBoxKeys: string[] = [];
        for (let i = 1; i < groups.length; i++) {
            for (const ab of groups[i].boxes) moveBoxKeys.push(ab.boxKey);
        }
        const moveLineIds: ID[] = [];
        for (const bk of moveBoxKeys) {
            const box = boxByKey.get(bk);
            if (box) moveLineIds.push(...box.lineIds);
        }

        // 一次性从源订单移除待迁移行
        if (moveLineIds.length > 0) {
            const rmRes = await this.orderService.removeItemsFromOrder(ctx, source.id, moveLineIds);
            if (isGraphQlErrorResult(rmRes)) {
                throw new UserInputError((rmRes as any).message ?? 'REMOVE_ITEMS_FAILED');
            }
        }

        // 各新订单：建单 → 迁移行 → 复制客户/配送地址 → 设置该组箱配送方式
        const newOrders: Order[] = [];
        for (let i = 1; i < groups.length; i++) {
            const items = this.buildItemsForGroup(groups[i].boxes.map(ab => ab.boxKey), boxByKey, lineInfo);
            if (items.length === 0) continue;
            const newOrder = (await this.orderService.create(ctx)) as Order;
            if ((source as any).customerId != null) {
                await this.orderService.updateOrderCustomer(ctx, {
                    customerId: String((source as any).customerId),
                    orderId: newOrder.id,
                });
            }
            if (source.shippingAddress?.countryCode) {
                await this.orderService.setShippingAddress(ctx, newOrder.id, this.mapAddress(source.shippingAddress));
            }
            const addRes = await this.orderService.addItemsToOrder(ctx, newOrder.id, items);
            if (isGraphQlErrorResult(addRes)) {
                throw new UserInputError((addRes as any).message ?? 'ADD_ITEMS_FAILED');
            }
            const freshNew = (await this.orderService.findOne(ctx, newOrder.id)) as Order;
            await this.orderBoxService.setShippingForOrder(
                ctx,
                freshNew,
                groups[i].boxes.map(ab => ab.boxKey),
                selections,
            );
            newOrders.push(freshNew);
        }

        // 源订单只保留 groups[0] 的箱；重新加载后设置其配送方式
        const remaining = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant'])) as Order;
        await this.orderBoxService.setShippingForOrder(
            ctx,
            remaining,
            groups[0].boxes.map(ab => ab.boxKey),
            selections,
        );

        // 逐单过渡到 ArrangingPayment 并支付
        const ids = [remaining.id, ...newOrders.map(o => o.id)];
        const settled: Order[] = [];
        for (const id of ids) {
            const t = await this.orderService.transitionToState(ctx, id, 'ArrangingPayment');
            if (isGraphQlErrorResult(t)) {
                throw new UserInputError((t as any).transitionError ?? 'TRANSITION_FAILED');
            }
            const paid = await this.orderService.addPaymentToOrder(ctx, id, { method, metadata });
            if (isGraphQlErrorResult(paid)) {
                throw new UserInputError((paid as any).paymentErrorMessage ?? 'PAYMENT_FAILED');
            }
            settled.push(paid as Order);
        }
        return settled;
    }

    /** 聚合一个 group 的箱，得到其 order lines 的 variant+qty 列表。 */
    private buildItemsForGroup(
        boxKeys: string[],
        boxByKey: Map<string, any>,
        lineInfo: Map<string, { variantId: string; qty: number }>,
    ): Array<{ productVariantId: ID; quantity: number }> {
        const items: Array<{ productVariantId: ID; quantity: number }> = [];
        for (const bk of boxKeys) {
            const box = boxByKey.get(bk);
            if (!box) continue;
            for (const lineId of box.lineIds as ID[]) {
                const info = lineInfo.get(String(lineId));
                if (info && info.qty > 0) {
                    items.push({ productVariantId: info.variantId as ID, quantity: info.qty });
                }
            }
        }
        return items;
    }

    /** 将 OrderAddress 简单 JSON 映射为 CreateAddressInput（缺省字段省略，交由核心兜底）。 */
    private mapAddress(addr: any): any {
        const out: any = {};
        for (const key of ['fullName', 'company', 'streetLine1', 'streetLine2', 'city', 'province', 'postalCode', 'countryCode', 'phoneNumber']) {
            if (addr?.[key] != null && addr[key] !== '') out[key] = addr[key];
        }
        return out;
    }
}