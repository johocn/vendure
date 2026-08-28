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
let OrderSplitService = class OrderSplitService {
    constructor(orderService, orderBoxService) {
        this.orderService = orderService;
        this.orderBoxService = orderBoxService;
    }
    /**
     * 一次性拆单并逐单完成支付，返回需各自结算的订单列表（均已付款结算）。
     *
     * @param order 源活动订单（含全部 box 的 lines）
     * @param method 所选支付方式 code（同时驱动聚合判定）
     * @param metadata 支付方式透传 metadata
     */
    async performSplitCheckout(ctx, order, method, metadata) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        // 显式带 lines.productVariant 重新加载，保证分箱与行迁移数据准确
        const source = (await this.orderService.findOne(ctx, order.id, ['lines.productVariant', 'customer']));
        if (!source)
            throw new core_1.UserInputError('NO_ACTIVE_ORDER');
        const boxes = await this.orderBoxService.computeOrderBoxes(ctx, source);
        if (boxes.length === 0)
            throw new core_1.UserInputError('NO_BOXES');
        const aggBoxes = boxes.map(b => ({
            boxKey: b.boxKey,
            profileId: String(b.profileId),
            tenantChannelId: String(b.tenantChannelId),
            availablePaymentMethodCodes: b.availablePaymentMethodCodes,
        }));
        const { groups } = (0, order_box_aggregation_1.decideAggregation)({ boxes: aggBoxes, userSelectedPaymentMethod: method });
        if (groups.length === 0)
            throw new core_1.UserInputError('NO_AGGREGATION_GROUP');
        const boxByKey = new Map(boxes.map(b => [b.boxKey, b]));
        const selections = this.orderBoxService.getBoxSelections(source);
        // 每行 variantId+qty 快照（迁移用）
        const lineInfo = new Map();
        for (const line of (_a = source.lines) !== null && _a !== void 0 ? _a : []) {
            const vid = (_b = line.productVariantId) !== null && _b !== void 0 ? _b : (_c = line.productVariant) === null || _c === void 0 ? void 0 : _c.id;
            if (vid == null)
                continue;
            lineInfo.set(String(line.id), { variantId: String(vid), qty: (_d = line.quantity) !== null && _d !== void 0 ? _d : 0 });
        }
        // 需要迁移到新订单的箱 = groups[1..n]
        const moveBoxKeys = [];
        for (let i = 1; i < groups.length; i++) {
            for (const ab of groups[i].boxes)
                moveBoxKeys.push(ab.boxKey);
        }
        const moveLineIds = [];
        for (const bk of moveBoxKeys) {
            const box = boxByKey.get(bk);
            if (box)
                moveLineIds.push(...box.lineIds);
        }
        // 一次性从源订单移除待迁移行
        if (moveLineIds.length > 0) {
            const rmRes = await this.orderService.removeItemsFromOrder(ctx, source.id, moveLineIds);
            if ((0, core_1.isGraphQlErrorResult)(rmRes)) {
                throw new core_1.UserInputError((_e = rmRes.message) !== null && _e !== void 0 ? _e : 'REMOVE_ITEMS_FAILED');
            }
        }
        // 各新订单：建单 → 迁移行 → 复制客户/配送地址 → 设置该组箱配送方式
        const newOrders = [];
        for (let i = 1; i < groups.length; i++) {
            const items = this.buildItemsForGroup(groups[i].boxes.map(ab => ab.boxKey), boxByKey, lineInfo);
            if (items.length === 0)
                continue;
            const newOrder = (await this.orderService.create(ctx));
            if (source.customerId != null) {
                await this.orderService.updateOrderCustomer(ctx, {
                    customerId: String(source.customerId),
                    orderId: newOrder.id,
                });
            }
            if ((_f = source.shippingAddress) === null || _f === void 0 ? void 0 : _f.countryCode) {
                await this.orderService.setShippingAddress(ctx, newOrder.id, this.mapAddress(source.shippingAddress));
            }
            const addRes = await this.orderService.addItemsToOrder(ctx, newOrder.id, items);
            if ((0, core_1.isGraphQlErrorResult)(addRes)) {
                throw new core_1.UserInputError((_g = addRes.message) !== null && _g !== void 0 ? _g : 'ADD_ITEMS_FAILED');
            }
            const freshNew = (await this.orderService.findOne(ctx, newOrder.id));
            await this.orderBoxService.setShippingForOrder(ctx, freshNew, groups[i].boxes.map(ab => ab.boxKey), selections);
            newOrders.push(freshNew);
        }
        // 源订单只保留 groups[0] 的箱；重新加载后设置其配送方式
        const remaining = (await this.orderService.findOne(ctx, source.id, ['lines.productVariant']));
        await this.orderBoxService.setShippingForOrder(ctx, remaining, groups[0].boxes.map(ab => ab.boxKey), selections);
        // 逐单过渡到 ArrangingPayment 并支付
        const ids = [remaining.id, ...newOrders.map(o => o.id)];
        const settled = [];
        for (const id of ids) {
            const t = await this.orderService.transitionToState(ctx, id, 'ArrangingPayment');
            if ((0, core_1.isGraphQlErrorResult)(t)) {
                throw new core_1.UserInputError((_h = t.transitionError) !== null && _h !== void 0 ? _h : 'TRANSITION_FAILED');
            }
            const paid = await this.orderService.addPaymentToOrder(ctx, id, { method, metadata });
            if ((0, core_1.isGraphQlErrorResult)(paid)) {
                throw new core_1.UserInputError((_j = paid.paymentErrorMessage) !== null && _j !== void 0 ? _j : 'PAYMENT_FAILED');
            }
            settled.push(paid);
        }
        return settled;
    }
    /** 聚合一个 group 的箱，得到其 order lines 的 variant+qty 列表。 */
    buildItemsForGroup(boxKeys, boxByKey, lineInfo) {
        const items = [];
        for (const bk of boxKeys) {
            const box = boxByKey.get(bk);
            if (!box)
                continue;
            for (const lineId of box.lineIds) {
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
        order_box_service_1.OrderBoxService])
], OrderSplitService);
//# sourceMappingURL=order-split.service.js.map