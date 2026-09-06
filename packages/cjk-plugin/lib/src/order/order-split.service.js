"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderSplitService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const order_box_service_1 = require("./order-box.service");
const order_box_aggregation_1 = require("./order-box-aggregation");
const merchant_settlement_service_1 = require("./merchant-settlement.service");
const redemption_code_service_1 = require("../redemption/redemption-code.service");
const constants_1 = require("../constants");
const timing_util_1 = require("./timing.util");
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
let OrderSplitService = class OrderSplitService {
    constructor(orderService, orderBoxService, merchantSettlementService, redemptionCodeService) {
        this.orderService = orderService;
        this.orderBoxService = orderBoxService;
        this.merchantSettlementService = merchantSettlementService;
        this.redemptionCodeService = redemptionCodeService;
    }
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
    async performSplitCheckout(ctx, order, method, metadata, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        const opts = options !== null && options !== void 0 ? options : {};
        const t0 = (0, timing_util_1.perf)();
        const boxT0 = (0, timing_util_1.perf)();
        // 显式带 lines.productVariant 重新加载，保证分箱与行迁移数据准确
        const source = (await this.orderService.findOne(ctx, order.id, ['lines.productVariant', 'customer']));
        if (!source)
            throw new core_1.UserInputError('NO_ACTIVE_ORDER');
        const boxes = await this.orderBoxService.computeOrderBoxes(ctx, source);
        core_1.Logger.info(`[timing] performSplitCheckout#findOne+computeOrderBoxes order=${order.id} = ${(0, timing_util_1.perf)(boxT0)}ms`, constants_1.loggerCtx);
        if (boxes.length === 0)
            throw new core_1.UserInputError('NO_BOXES');
        // —— 1) 依据 boxKeys/lineIds 计算「参与结算」的箱与行 ——
        const hasBoxRestriction = ((_b = (_a = opts.boxKeys) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0;
        const hasLineRestriction = ((_d = (_c = opts.lineIds) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0) > 0;
        const boxKeyOpts = new Set(((_e = opts.boxKeys) !== null && _e !== void 0 ? _e : []).map(k => String(k)));
        const lineIdOpts = new Set(((_f = opts.lineIds) !== null && _f !== void 0 ? _f : []).map(k => String(k)));
        const selectedBoxKeys = [];
        const selectedLineIdSet = new Set();
        for (const box of boxes) {
            const boxSelected = !hasBoxRestriction || boxKeyOpts.has(box.boxKey);
            if (!boxSelected)
                continue;
            const boxLineIds = box.lineIds.map(l => String(l));
            const chosen = hasLineRestriction ? boxLineIds.filter(lid => lineIdOpts.has(lid)) : boxLineIds;
            // 该箱被选但其行全部被 lineIds 排除 → 视为未选中
            if (chosen.length === 0)
                continue;
            selectedBoxKeys.push(box.boxKey);
            for (const lid of chosen)
                selectedLineIdSet.add(lid);
        }
        if (selectedLineIdSet.size === 0)
            throw new core_1.UserInputError('NO_ITEMS_TO_CHECKOUT');
        // 未选中的行（回流购物车）必须留在源活动订单，不得迁入任何结算单
        const allLineIds = new Set(((_g = source.lines) !== null && _g !== void 0 ? _g : []).map(l => String(l.id)));
        const excludedLineIds = (((_h = opts.boxKeys) === null || _h === void 0 ? void 0 : _h.length) || ((_j = opts.lineIds) === null || _j === void 0 ? void 0 : _j.length))
            ? [...allLineIds].filter(lid => !selectedLineIdSet.has(lid))
            : [];
        const isFullSelection = excludedLineIds.length === 0;
        // —— 2) 聚合判定仅针对「所选箱」（含同箱内部分行过滤） ——
        const selectedBoxes = boxes.filter(b => selectedBoxKeys.includes(b.boxKey));
        const aggBoxes = selectedBoxes.map(b => ({
            boxKey: b.boxKey,
            profileId: String(b.profileId),
            tenantChannelId: String(b.tenantChannelId),
            availablePaymentMethodCodes: b.availablePaymentMethodCodes,
        }));
        const { groups } = (0, order_box_aggregation_1.decideAggregation)({ boxes: aggBoxes, userSelectedPaymentMethod: method });
        if (groups.length === 0)
            throw new core_1.UserInputError('NO_AGGREGATION_GROUP');
        const boxByKey = new Map(boxes.map(b => [b.boxKey, b]));
        // —— 行归属唯一性校验：任一被选中行只允许归入「一个」结算组 ——
        // 引擎的分组本是 boxes 的划分，正常不会重叠；但若上游分箱把同一 orderLine 派到多个 box/组，
        // 重构行时会在多个订单里各建一份 → 数量翻倍计费。此处显式拦截并抛错（事务回滚）。
        const allocLineIds = new Set();
        for (const g of groups) {
            for (const ab of g.boxes) {
                const box = boxByKey.get(ab.boxKey);
                if (!box)
                    continue;
                for (const lid of box.lineIds) {
                    if (!selectedLineIdSet.has(String(lid)))
                        continue;
                    if (allocLineIds.has(String(lid))) {
                        throw new core_1.UserInputError(`LINE_IN_MULTIPLE_GROUPS lineId=${lid}`);
                    }
                    allocLineIds.add(String(lid));
                }
            }
        }
        const selections = this.orderBoxService.getBoxSelections(source);
        // 每行 variantId+qty 快照（迁移用）
        const lineInfo = new Map();
        // 结算前各变体数量基准（数量守恒校验用）。基于订单 order_id 聚合计算避免同变体合并。
        const sourceQtyByVariant = new Map();
        for (const line of (_k = source.lines) !== null && _k !== void 0 ? _k : []) {
            const vid = (_l = line.productVariantId) !== null && _l !== void 0 ? _l : (_m = line.productVariant) === null || _m === void 0 ? void 0 : _m.id;
            if (vid == null)
                continue;
            const q = (_o = line.quantity) !== null && _o !== void 0 ? _o : 0;
            lineInfo.set(String(line.id), { variantId: String(vid), qty: q });
            sourceQtyByVariant.set(String(vid), ((_p = sourceQtyByVariant.get(String(vid))) !== null && _p !== void 0 ? _p : 0) + q);
        }
        // 全选：group[0] 保留在源订单（维持旧逻辑）；部分选：每个 group 均需新建独立订单迁出
        const newGroupStart = isFullSelection ? 1 : 0;
        // 待从源订单移除、迁往新订单的行
        let moveLineIds;
        if (isFullSelection) {
            moveLineIds = [];
            for (let i = newGroupStart; i < groups.length; i++) {
                for (const ab of groups[i].boxes) {
                    const box = boxByKey.get(ab.boxKey);
                    if (!box)
                        continue;
                    for (const lid of box.lineIds) {
                        if (selectedLineIdSet.has(String(lid)))
                            moveLineIds.push(lid);
                    }
                }
            }
        }
        else {
            // 部分选：把所有选中行全部迁出，源订单仅保留回流行
            moveLineIds = [...selectedLineIdSet];
        }
        // 一次性从源订单移除待迁移行
        if (moveLineIds.length > 0) {
            const rmRes = await this.orderService.removeItemsFromOrder(ctx, source.id, moveLineIds);
            if ((0, core_1.isGraphQlErrorResult)(rmRes)) {
                throw new core_1.UserInputError((_q = rmRes.message) !== null && _q !== void 0 ? _q : 'REMOVE_ITEMS_FAILED');
            }
        }
        // 各新订单：建单 → 迁移行 → 复制客户/配送地址 → 设置该组箱配送方式
        const newOrders = [];
        for (let i = newGroupStart; i < groups.length; i++) {
            const items = this.buildItemsForGroup(groups[i].boxes.map(ab => ab.boxKey), boxByKey, lineInfo, selectedLineIdSet);
            if (items.length === 0)
                continue;
            const newOrder = (await this.orderService.create(ctx));
            if (source.customerId != null) {
                await this.orderService.updateOrderCustomer(ctx, {
                    customerId: String(source.customerId),
                    orderId: newOrder.id,
                });
            }
            if ((_r = source.shippingAddress) === null || _r === void 0 ? void 0 : _r.countryCode) {
                await this.orderService.setShippingAddress(ctx, newOrder.id, this.mapAddress(source.shippingAddress));
            }
            const addRes = await this.orderService.addItemsToOrder(ctx, newOrder.id, items);
            if ((0, core_1.isGraphQlErrorResult)(addRes)) {
                throw new core_1.UserInputError((_s = addRes.message) !== null && _s !== void 0 ? _s : 'ADD_ITEMS_FAILED');
            }
            const freshNew = (await this.orderService.findOne(ctx, newOrder.id));
            await this.orderBoxService.setShippingForOrder(ctx, freshNew, groups[i].boxes.map(ab => ab.boxKey), selections);
            newOrders.push(freshNew);
        }
        // 需要「逐步结算」的订单：全选 = 源订单(group[0]) + 各新订单；部分选 = 仅各新订单（源订单留作购物车）
        const toSettle = [];
        if (isFullSelection) {
            const remaining = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant']));
            await this.orderBoxService.setShippingForOrder(ctx, remaining, groups[0].boxes.map(ab => ab.boxKey), selections);
            toSettle.push(remaining);
        }
        toSettle.push(...newOrders);
        // 逐单过渡到 ArrangingPayment 并支付
        const settled = [];
        const settleT0 = (0, timing_util_1.perf)();
        for (const id of toSettle.map(o => o.id)) {
            const tOrder = (0, timing_util_1.perf)();
            const t = await this.orderService.transitionToState(ctx, id, 'ArrangingPayment');
            if ((0, core_1.isGraphQlErrorResult)(t)) {
                throw new core_1.UserInputError((_t = t.transitionError) !== null && _t !== void 0 ? _t : 'TRANSITION_FAILED');
            }
            const paid = await this.orderService.addPaymentToOrder(ctx, id, { method, metadata });
            if ((0, core_1.isGraphQlErrorResult)(paid)) {
                throw new core_1.UserInputError((_u = paid.paymentErrorMessage) !== null && _u !== void 0 ? _u : 'PAYMENT_FAILED');
            }
            // 台账级分账：为已结算订单按「商户（租户）」记录应付金额（每商户一行）；
            // 在同一 @Transaction 内写入，与订单结算原子一致。COD/门店收银记为 PENDING_SIGN，在线方式记为 PAID。
            const settleRecT0 = (0, timing_util_1.perf)();
            await this.merchantSettlementService.recordOrderSettlement(ctx, paid, {
                method,
                codPaymentCodes: [...merchant_settlement_service_1.COD_PAYMENT_CODES],
            });
            // 下单同步生成核销码：best-effort、并入本结单事务单一写者，避免与 C端 orderRedemptionCode 并发生成不同码
            // （旧实现为 OrderStateTransitionEvent 异步后台 ensure，会产生 check-then-act 竞态、码被覆盖后 lookup 查不到）。
            try {
                await this.redemptionCodeService.ensure(ctx, paid.id);
            }
            catch (e) {
                core_1.Logger.error(`checkout ensure redemption code failed: ${(_v = e === null || e === void 0 ? void 0 : e.message) !== null && _v !== void 0 ? _v : e}`, constants_1.loggerCtx);
            }
            core_1.Logger.info(`[timing] performSplitCheckout#settleOne order=${id} settle=${(0, timing_util_1.perf)(tOrder)}ms recordLedger=${(0, timing_util_1.perf)(settleRecT0)}ms`, constants_1.loggerCtx);
            settled.push(paid);
        }
        core_1.Logger.info(`[timing] performSplitCheckout#settleLoop orders=${settled.length} = ${(0, timing_util_1.perf)(settleT0)}ms`, constants_1.loggerCtx);
        // —— 部分选：回流行的源订单保持 AddingItems（购物车态）；若已迁空且有结算单 → best-effort 取消 ——
        if (!isFullSelection) {
            const after = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant']));
            if (after && ((_w = after.lines) !== null && _w !== void 0 ? _w : []).length === 0 && newOrders.length > 0) {
                try {
                    await this.orderService.transitionToState(ctx, source.id, 'Cancelled');
                }
                catch (_x) {
                    /* 取消失败不抛，任其闲置，避免留下陈旧的空活动订单（best-effort） */
                }
            }
        }
        // —— 数量守恒校验（兜底）：结算后「各结算单 + 源回流行」同变体数量总和 = 源订单结算前数量 ——
        // 若某行在分组/迁移中被复制到多个订单（如同一个变体被错误复刻进自提+配送两单），
        // 此校验不通过并抛错（在 @Transaction 内整体回滚），杜绝数量/金额翻倍落地。
        await this.verifyQuantityConservation(ctx, source, settled, sourceQtyByVariant);
        core_1.Logger.info(`[timing] performSplitCheckout END order=${order.id} = ${(0, timing_util_1.perf)(t0)}ms -> ${settled.length} orders`, constants_1.loggerCtx);
        return settled;
    }
    /** 校验拆单结算后数量守恒；不等即抛错（依赖调用方 @Transaction 原子回滚）。 */
    async verifyQuantityConservation(ctx, source, settled, sourceQtyByVariant) {
        var _a;
        if (sourceQtyByVariant.size === 0)
            return;
        const tally = new Map();
        const addLines = (o) => {
            var _a, _b, _c, _d, _e;
            for (const l of (_a = o === null || o === void 0 ? void 0 : o.lines) !== null && _a !== void 0 ? _a : []) {
                const vid = String((_b = l.productVariantId) !== null && _b !== void 0 ? _b : (_c = l.productVariant) === null || _c === void 0 ? void 0 : _c.id);
                if (vid === 'null' || vid === 'undefined')
                    continue;
                tally.set(vid, ((_d = tally.get(vid)) !== null && _d !== void 0 ? _d : 0) + Number((_e = l.quantity) !== null && _e !== void 0 ? _e : 0));
            }
        };
        for (const o of settled)
            addLines(o);
        // 部分选时，源订单保留未结算回流行，也计入总数
        if (!settled.some(o => o.id === source.id)) {
            const after = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant']));
            addLines(after);
        }
        for (const [vid, want] of sourceQtyByVariant) {
            const got = (_a = tally.get(vid)) !== null && _a !== void 0 ? _a : 0;
            if (got !== want) {
                throw new core_1.UserInputError(`QUANTITY_MISMATCH variant=${vid} expect=${want} actual=${got}`);
            }
        }
    }
    /** 聚合一个 group 的箱，得到其「被选中」的 order lines 的 variant+qty 列表。 */
    buildItemsForGroup(boxKeys, boxByKey, lineInfo, selectedLineIdSet) {
        const items = [];
        for (const bk of boxKeys) {
            const box = boxByKey.get(bk);
            if (!box)
                continue;
            for (const lineId of box.lineIds) {
                if (!selectedLineIdSet.has(String(lineId)))
                    continue;
                const info = lineInfo.get(String(lineId));
                if (info && info.qty > 0) {
                    items.push({ productVariantId: info.variantId, quantity: info.qty });
                }
            }
        }
        return items;
    }
    /** 将 OrderAddress 简单 JSON 映射为 CreateAddressInput（缺省字段省略，交由核心兜底）。 */
    mapAddress(addr) {
        const out = {};
        for (const key of ['fullName', 'company', 'streetLine1', 'streetLine2', 'city', 'province', 'postalCode', 'countryCode', 'phoneNumber']) {
            if ((addr === null || addr === void 0 ? void 0 : addr[key]) != null && addr[key] !== '')
                out[key] = addr[key];
        }
        return out;
    }
};
exports.OrderSplitService = OrderSplitService;
exports.OrderSplitService = OrderSplitService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.OrderService,
        order_box_service_1.OrderBoxService,
        merchant_settlement_service_1.MerchantSettlementService,
        redemption_code_service_1.RedemptionCodeService])
], OrderSplitService);
//# sourceMappingURL=order-split.service.js.map