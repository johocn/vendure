import { Injectable } from '@nestjs/common';
import { ID, Logger, Order, OrderService, RequestContext, UserInputError, isGraphQlErrorResult } from '@vendure/core';
import { OrderBoxService } from './order-box.service';
import { AggregationBox, decideAggregation } from './order-box-aggregation';
import { COD_PAYMENT_CODES, MerchantSettlementService } from './merchant-settlement.service';
import { loggerCtx } from '../constants';
import { perf } from './timing.util';

/**
 * 后端「一次性拆单结算」服务（统一入口，由 checkoutSplitted 调用）。
 *
 * 语义：源活动订单内所有 box 在一个 Order（AddingItems 态）。聚合引擎（decideAggregation）
 * 按所选支付方式决定分组：余额 → 全部箱并 1 组（不拆）；非余额 → 每箱独立成组。
 * groups 头 1 组保留在源订单，其余各组各建新订单，并把对应箱的订单行从源订单迁移到新订单，
 * 最后逐单过渡到 ArrangingPayment 并 addPaymentToOrder。
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
        private merchantSettlementService: MerchantSettlementService,
    ) {}

    /**
     * 一次性拆单并逐单完成支付，返回需各自结算的订单列表（均已付款结算）。
     *
     * 支持部分结算（return-to-cart）：
     * - 不传 opts（或传了但覆盖全部箱/行）→ 全选，走与旧版完全一致的路径；
     * - 传 boxKeys/lineIds 限定 → 仅结算所选箱/行，未选中的行留在源活动订单（购物车）不结算。
     *
     * @param order 源活动订单（含全部 box 的 lines）
     * @param method 所选支付方式 code（同时驱动聚合判定）
     * @param metadata 支付方式透传 metadata
     * @param options.boxKeys 可选：限定要结算的箱（boxKey）集合
     * @param options.lineIds 可选：在选定箱内进一步限定要结算的行（orderLineId）
     */
    async performSplitCheckout(
        ctx: RequestContext,
        order: Order,
        method: string,
        metadata?: Record<string, any>,
        options?: { boxKeys?: ID[]; lineIds?: ID[] },
    ): Promise<Order[]> {
        const opts = options ?? {};
        const t0 = perf();
        const boxT0 = perf();
        // 显式带 lines.productVariant 重新加载，保证分箱与行迁移数据准确
        const source = (await this.orderService.findOne(ctx, order.id, ['lines.productVariant', 'customer'])) as Order;
        if (!source) throw new UserInputError('NO_ACTIVE_ORDER');

        const boxes = await this.orderBoxService.computeOrderBoxes(ctx, source);
        Logger.info(`[timing] performSplitCheckout#findOne+computeOrderBoxes order=${order.id} = ${perf(boxT0)}ms`, loggerCtx);
        if (boxes.length === 0) throw new UserInputError('NO_BOXES');

        // —— 1) 依据 boxKeys/lineIds 计算「参与结算」的箱与行 ——
        const hasBoxRestriction = (opts.boxKeys?.length ?? 0) > 0;
        const hasLineRestriction = (opts.lineIds?.length ?? 0) > 0;
        const boxKeyOpts = new Set((opts.boxKeys ?? []).map(k => String(k)));
        const lineIdOpts = new Set((opts.lineIds ?? []).map(k => String(k)));

        const selectedBoxKeys: string[] = [];
        const selectedLineIdSet = new Set<string>();
        for (const box of boxes) {
            const boxSelected = !hasBoxRestriction || boxKeyOpts.has(box.boxKey);
            if (!boxSelected) continue;
            const boxLineIds = box.lineIds.map(l => String(l));
            const chosen = hasLineRestriction ? boxLineIds.filter(lid => lineIdOpts.has(lid)) : boxLineIds;
            // 该箱被选但其行全部被 lineIds 排除 → 视为未选中
            if (chosen.length === 0) continue;
            selectedBoxKeys.push(box.boxKey);
            for (const lid of chosen) selectedLineIdSet.add(lid);
        }
        if (selectedLineIdSet.size === 0) throw new UserInputError('NO_ITEMS_TO_CHECKOUT');

        // 未选中的行（回流购物车）必须留在源活动订单，不得迁入任何结算单
        const allLineIds = new Set<string>((source.lines ?? []).map(l => String((l as any).id)));
        const excludedLineIds = (opts.boxKeys?.length || opts.lineIds?.length)
            ? [...allLineIds].filter(lid => !selectedLineIdSet.has(lid))
            : [];
        const isFullSelection = excludedLineIds.length === 0;

        // —— 2) 聚合判定仅针对「所选箱」（含同箱内部分行过滤） ——
        const selectedBoxes = boxes.filter(b => selectedBoxKeys.includes(b.boxKey));
        const aggBoxes: AggregationBox[] = selectedBoxes.map(b => ({
            boxKey: b.boxKey,
            profileId: String(b.profileId),
            tenantChannelId: String(b.tenantChannelId),
            availablePaymentMethodCodes: b.availablePaymentMethodCodes,
        }));
        const { groups } = decideAggregation({ boxes: aggBoxes, userSelectedPaymentMethod: method });
        if (groups.length === 0) throw new UserInputError('NO_AGGREGATION_GROUP');

        const boxByKey = new Map(boxes.map(b => [b.boxKey, b]));
        // —— 行归属唯一性校验：任一被选中行只允许归入「一个」结算组 ——
        // 引擎的分组本是 boxes 的划分，正常不会重叠；但若上游分箱把同一 orderLine 派到多个 box/组，
        // 重构行时会在多个订单里各建一份 → 数量翻倍计费。此处显式拦截并抛错（事务回滚）。
        const allocLineIds = new Set<string>();
        for (const g of groups) {
            for (const ab of g.boxes) {
                const box = boxByKey.get(ab.boxKey);
                if (!box) continue;
                for (const lid of box.lineIds as ID[]) {
                    if (!selectedLineIdSet.has(String(lid))) continue;
                    if (allocLineIds.has(String(lid))) {
                        throw new UserInputError(`LINE_IN_MULTIPLE_GROUPS lineId=${lid}`);
                    }
                    allocLineIds.add(String(lid));
                }
            }
        }
        const selections = this.orderBoxService.getBoxSelections(source);

        // 每行 variantId+qty 快照（迁移用）
        const lineInfo = new Map<string, { variantId: string; qty: number }>();
        // 结算前各变体数量基准（数量守恒校验用）。基于订单 order_id 聚合计算避免同变体合并。
        const sourceQtyByVariant = new Map<string, number>();
        for (const line of source.lines ?? []) {
            const vid = (line as any).productVariantId ?? (line as any).productVariant?.id;
            if (vid == null) continue;
            const q = (line as any).quantity ?? 0;
            lineInfo.set(String(line.id), { variantId: String(vid), qty: q });
            sourceQtyByVariant.set(String(vid), (sourceQtyByVariant.get(String(vid)) ?? 0) + q);
        }

        // 全选：group[0] 保留在源订单（维持旧逻辑）；部分选：每个 group 均需新建独立订单迁出
        const newGroupStart = isFullSelection ? 1 : 0;

        // 待从源订单移除、迁往新订单的行
        let moveLineIds: ID[];
        if (isFullSelection) {
            moveLineIds = [];
            for (let i = newGroupStart; i < groups.length; i++) {
                for (const ab of groups[i].boxes) {
                    const box = boxByKey.get(ab.boxKey);
                    if (!box) continue;
                    for (const lid of box.lineIds as ID[]) {
                        if (selectedLineIdSet.has(String(lid))) moveLineIds.push(lid);
                    }
                }
            }
        } else {
            // 部分选：把所有选中行全部迁出，源订单仅保留回流行
            moveLineIds = [...selectedLineIdSet] as ID[];
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
        for (let i = newGroupStart; i < groups.length; i++) {
            const items = this.buildItemsForGroup(
                groups[i].boxes.map(ab => ab.boxKey),
                boxByKey,
                lineInfo,
                selectedLineIdSet,
            );
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

        // 需要「逐步结算」的订单：全选 = 源订单(group[0]) + 各新订单；部分选 = 仅各新订单（源订单留作购物车）
        const toSettle: Order[] = [];
        if (isFullSelection) {
            const remaining = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant'])) as Order;
            await this.orderBoxService.setShippingForOrder(
                ctx,
                remaining,
                groups[0].boxes.map(ab => ab.boxKey),
                selections,
            );
            toSettle.push(remaining);
        }
        toSettle.push(...newOrders);

        // 逐单过渡到 ArrangingPayment 并支付
        const settled: Order[] = [];
        const settleT0 = perf();
        for (const id of toSettle.map(o => o.id)) {
            const tOrder = perf();
            const t = await this.orderService.transitionToState(ctx, id, 'ArrangingPayment');
            if (isGraphQlErrorResult(t)) {
                throw new UserInputError((t as any).transitionError ?? 'TRANSITION_FAILED');
            }
            const paid = await this.orderService.addPaymentToOrder(ctx, id, { method, metadata });
            if (isGraphQlErrorResult(paid)) {
                throw new UserInputError((paid as any).paymentErrorMessage ?? 'PAYMENT_FAILED');
            }
            // 台账级分账：为已结算订单按「商户（租户）」记录应付金额（每商户一行）；
            // 在同一 @Transaction 内写入，与订单结算原子一致。COD/门店收银记为 PENDING_SIGN，在线方式记为 PAID。
            const settleRecT0 = perf();
            await this.merchantSettlementService.recordOrderSettlement(ctx, paid as Order, {
                method,
                codPaymentCodes: [...COD_PAYMENT_CODES],
            });
            Logger.info(`[timing] performSplitCheckout#settleOne order=${id} settle=${perf(tOrder)}ms recordLedger=${perf(settleRecT0)}ms`, loggerCtx);
            settled.push(paid as Order);
        }
        Logger.info(`[timing] performSplitCheckout#settleLoop orders=${settled.length} = ${perf(settleT0)}ms`, loggerCtx);

        // —— 部分选：回流行的源订单保持 AddingItems（购物车态）；若已迁空且有结算单 → best-effort 取消 ——
        if (!isFullSelection) {
            const after = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant'])) as Order;
            if (after && (after.lines ?? []).length === 0 && newOrders.length > 0) {
                try {
                    await this.orderService.transitionToState(ctx, source.id, 'Cancelled');
                } catch {
                    /* 取消失败不抛，任其闲置，避免留下陈旧的空活动订单（best-effort） */
                }
            }
        }

        // —— 数量守恒校验（兜底）：结算后「各结算单 + 源回流行」同变体数量总和 = 源订单结算前数量 ——
        // 若某行在分组/迁移中被复制到多个订单（如同一个变体被错误复刻进自提+配送两单），
        // 此校验不通过并抛错（在 @Transaction 内整体回滚），杜绝数量/金额翻倍落地。
        await this.verifyQuantityConservation(ctx, source, settled, sourceQtyByVariant);

        Logger.info(`[timing] performSplitCheckout END order=${order.id} = ${perf(t0)}ms -> ${settled.length} orders`, loggerCtx);
        return settled;
    }

    /** 校验拆单结算后数量守恒；不等即抛错（依赖调用方 @Transaction 原子回滚）。 */
    private async verifyQuantityConservation(
        ctx: RequestContext,
        source: Order,
        settled: Order[],
        sourceQtyByVariant: Map<string, number>,
    ): Promise<void> {
        if (sourceQtyByVariant.size === 0) return;
        const tally = new Map<string, number>();
        const addLines = (o: any) => {
            for (const l of o?.lines ?? []) {
                const vid = String((l as any).productVariantId ?? (l as any).productVariant?.id);
                if (vid === 'null' || vid === 'undefined') continue;
                tally.set(vid, (tally.get(vid) ?? 0) + Number((l as any).quantity ?? 0));
            }
        };
        for (const o of settled) addLines(o);
        // 部分选时，源订单保留未结算回流行，也计入总数
        if (!settled.some(o => o.id === source.id)) {
            const after = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant'])) as Order;
            addLines(after);
        }
        for (const [vid, want] of sourceQtyByVariant) {
            const got = tally.get(vid) ?? 0;
            if (got !== want) {
                throw new UserInputError(`QUANTITY_MISMATCH variant=${vid} expect=${want} actual=${got}`);
            }
        }
    }

    /** 聚合一个 group 的箱，得到其「被选中」的 order lines 的 variant+qty 列表。 */
    private buildItemsForGroup(
        boxKeys: string[],
        boxByKey: Map<string, any>,
        lineInfo: Map<string, { variantId: string; qty: number }>,
        selectedLineIdSet: Set<string>,
    ): Array<{ productVariantId: ID; quantity: number }> {
        const items: Array<{ productVariantId: ID; quantity: number }> = [];
        for (const bk of boxKeys) {
            const box = boxByKey.get(bk);
            if (!box) continue;
            for (const lineId of box.lineIds as ID[]) {
                if (!selectedLineIdSet.has(String(lineId))) continue;
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