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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PickupService = void 0;
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const shop_plugin_1 = require("@vendure/shop-plugin");
const constants_1 = require("./constants");
const pickup_redemption_entity_1 = require("./pickup-redemption.entity");
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 去易混淆 0/O1/I/L
let PickupService = class PickupService {
    constructor(options, connection, orderService, fulfillmentService, administratorService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
        this.fulfillmentService = fulfillmentService;
        this.administratorService = administratorService;
    }
    genCode() {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
        return code;
    }
    async genUniqueCode(ctx) {
        for (let i = 0; i < 10; i++) {
            const code = this.genCode();
            const hit = await this.connection
                .getRepository(ctx, pickup_redemption_entity_1.PickupRedemption)
                .findOne({ where: { code } });
            if (!hit)
                return code;
        }
        throw new core_1.UserInputError('Failed to generate a unique pickup code');
    }
    async requireMyOrder(ctx, orderId) {
        var _a, _b;
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        const uid = (_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!order || !uid || uid !== ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        return order;
    }
    async requireMyShop(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null)
            throw new core_1.ForbiddenError();
        const shop = await this.connection
            .getRepository(ctx, shop_plugin_1.Shop)
            .findOne({ where: { administratorId: admin.id } });
        if (!shop || shop.status !== 'active')
            throw new core_1.ForbiddenError();
        return shop;
    }
    isPickupPaid(ctx, order) {
        var _a, _b;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        // 「已付款 pickup 单」：履约方式为 pickup，且订单已完成支付（授权/结算及之后的物流各态均算）。
        return (cf.deliveryType === 'pickup' &&
            ![
                'AddingItems',
                'ArrangingPayment',
                'Draft',
                'Cancelled',
                'PaymentAuthorized',
            ].includes(order.state) &&
            ((_b = order.totalWithTax) !== null && _b !== void 0 ? _b : 0) > 0);
    }
    /**
     * 店归属强校验：被核销订单主商品的 Product.customFields.shopId 归店（与 settlement-plugin 阶段24
     * 按店拆账同一判据）。订单任一行商品归属本店即视为本店单，否则不归属。
     */
    async orderBelongsToShop(ctx, orderId, shopId) {
        var _a;
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
        ]);
        const lines = ((_a = order === null || order === void 0 ? void 0 : order.lines) !== null && _a !== void 0 ? _a : []);
        if (lines.length === 0) {
            return false;
        }
        return lines.some((l) => {
            var _a, _b, _c, _d;
            const sid = (_d = ((_c = (_b = (_a = l === null || l === void 0 ? void 0 : l.productVariant) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.customFields) !== null && _c !== void 0 ? _c : {})) === null || _d === void 0 ? void 0 : _d.shopId;
            return sid != null && Number(sid) === shopId;
        });
    }
    /** 懒生成/取回固定提货码（幂等：一生对一单）。 */
    async resolveMyPickupCode(ctx, orderId) {
        const order = await this.requireMyOrder(ctx, orderId);
        if (!this.isPickupPaid(ctx, order)) {
            throw new core_1.UserInputError('Order is not a paid pickup order');
        }
        return this.getOrCreateRedemption(ctx, order);
    }
    async getOrCreateRedemption(ctx, order) {
        const repo = this.connection.getRepository(ctx, pickup_redemption_entity_1.PickupRedemption);
        const existing = await repo.findOne({ where: { orderId: order.id } });
        if (existing)
            return existing;
        const code = await this.genUniqueCode(ctx);
        const entity = repo.create({
            channelId: ctx.channelId,
            orderId: order.id,
            code,
            status: 'generated',
        });
        const saved = await repo.save(entity);
        return saved;
    }
    /**
     * 为「已付款的 pickup 订单」幂等生成提货码（自动生码；供事件订阅与游客查询兜底调用）。
     * 非 pickup 或未过支付闸门（isPickupPaid 排除 PaymentAuthorized 之前的状态）则不生成。
     */
    async ensurePickupRedemptionForOrder(ctx, orderId) {
        var _a;
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order)
            return;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (cf.deliveryType !== 'pickup')
            return;
        if (!this.isPickupPaid(ctx, order))
            return;
        await this.getOrCreateRedemption(ctx, order);
    }
    /** 核销闸门：校验凭据存在且 generated。 */
    async findGeneratable(ctx, orderId, code) {
        var _a;
        const repo = this.connection.getRepository(ctx, pickup_redemption_entity_1.PickupRedemption);
        const redemption = await repo.findOne({ where: { orderId: orderId } });
        if (!redemption)
            throw new core_1.UserInputError('Pickup code not found for order');
        if (redemption.status === 'void')
            throw new core_1.UserInputError('Pickup code has been voided');
        if (redemption.status === 'redeemed')
            throw new core_1.UserInputError('Pickup code already redeemed');
        if (redemption.code !== code)
            throw new core_1.UserInputError('Pickup code mismatch');
        const order = await this.orderService.findOne(ctx, orderId, ['fulfillments']);
        const shipped = ((_a = order === null || order === void 0 ? void 0 : order.fulfillments) !== null && _a !== void 0 ? _a : []).some(f => f.state === 'Shipped');
        if (!shipped)
            throw new core_1.UserInputError('Order not ready for pickup (not Shipped)');
        return [order, redemption];
    }
    /** 顾客自核销。 */
    async claimMyPickup(ctx, orderId, code) {
        await this.requireMyOrder(ctx, orderId);
        return this.commitRedeem(ctx, orderId, code, 'customer');
    }
    /** 店员核销（仅本店订单，跨店抛 Forbidden）。 */
    async claimPickupByShop(ctx, code) {
        // 先取店主所属店作为归属上下文
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, pickup_redemption_entity_1.PickupRedemption);
        const redemption = await repo.findOne({ where: { code } });
        if (!redemption)
            throw new core_1.UserInputError('Pickup code not found');
        // 店归属强校验：被核销订单主商品必须归本店，否则跨店核销拒绝。
        const owns = await this.orderBelongsToShop(ctx, redemption.orderId, shop.id);
        if (!owns) {
            throw new core_1.ForbiddenError();
        }
        if (redemption.status !== 'generated') {
            throw new core_1.UserInputError('Pickup code already used / voided');
        }
        return this.commitRedeem(ctx, redemption.orderId, code, 'shop');
    }
    async commitRedeem(ctx, orderId, code, claimChannel) {
        const [order, redemption] = await this.findGeneratable(ctx, orderId, code);
        const repo = this.connection.getRepository(ctx, pickup_redemption_entity_1.PickupRedemption);
        redemption.status = 'redeemed';
        redemption.claimedAt = new Date();
        redemption.claimedByUserId = ctx.activeUserId ? ctx.activeUserId : null;
        redemption.claimChannel = claimChannel;
        const saved = await repo.save(redemption);
        await this.connection.withTransaction(ctx, async (txCtx) => {
            var _a;
            await this.orderService.updateCustomFields(txCtx, orderId, { pickupClaimed: true });
            const withF = await this.orderService.findOne(txCtx, orderId, ['fulfillments']);
            for (const f of (_a = withF === null || withF === void 0 ? void 0 : withF.fulfillments) !== null && _a !== void 0 ? _a : []) {
                if (f.state === 'Shipped') {
                    await this.fulfillmentService.transitionToState(txCtx, f.id, 'Delivered');
                }
            }
        });
        return saved;
    }
    async onOrderCancelled(orderId) {
        // 由 plugin 订阅事件调用；用无 ctx 的连接
        const repo = this.connection.rawConnection.getRepository(pickup_redemption_entity_1.PickupRedemption);
        const r = await repo.findOne({ where: { orderId } });
        if (r && r.status === 'generated') {
            r.status = 'void';
            await repo.save(r);
        }
    }
    async myPickupOrders(ctx, options) {
        // 店主域：本店待核销 pickup 订单 → 反查 PickupRedemption（generated）
        // 简化：返回其属店由 resolver 依 Order.customFields → 自提点 shop 过滤；缺省返回全部 generated
        return this.listRedemptions(ctx, options, 'generated');
    }
    async listRedemptions(ctx, options = {}, status) {
        var _a, _b;
        return this.connection
            .getRepository(ctx, pickup_redemption_entity_1.PickupRedemption)
            .findAndCount({
            where: Object.assign({}, (status ? { status } : {})),
            take: (_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20,
            skip: (_b = options === null || options === void 0 ? void 0 : options.skip) !== null && _b !== void 0 ? _b : 0,
        });
    }
    async allRedemptions(ctx, options) {
        const [items, totalItems] = await this.listRedemptions(ctx, options);
        return { items, totalItems };
    }
};
exports.PickupService = PickupService;
exports.PickupService = PickupService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.PICKUP_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.FulfillmentService,
        core_1.AdministratorService])
], PickupService);
//# sourceMappingURL=pickup.service.js.map