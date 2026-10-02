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
exports.CouponSaleService = void 0;
exports.setCouponSaleGateway = setCouponSaleGateway;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_service_1 = require("./coupon.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const coupon_sale_order_entity_1 = require("./coupon-sale-order.entity");
const coupon_bundle_entity_1 = require("./coupon-bundle.entity");
const coupon_sale_1 = require("./coupon-sale");
const coupon_channel_1 = require("./coupon-channel");
const coupon_balance_port_1 = require("./coupon-balance-port");
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
/**
 * 进程内网关引用（镜像 recharge-card-plugin 的 setWechatpayGateway 模式）：
 * 由 plugin.ts 在启动时经 Injector 取到 WechatpayService 后 setCouponSaleGateway 注入；
 * 未装载 WechatpayPlugin 时为 null，微信支付入口提示网关未配置。
 */
let gatewayService = null;
function setCouponSaleGateway(gw) {
    gatewayService = gw;
}
/**
 * 出售链路编排：独立券商城（微信 / 余额）+ 加价购 + 退款回收。
 * 所有金额单位为「分」。订单/券的最终发放在 CouponService 内完成，本服务只做编排与状态机。
 */
let CouponSaleService = class CouponSaleService {
    constructor(connection, couponService, customerService) {
        this.connection = connection;
        this.couponService = couponService;
        this.customerService = customerService;
    }
    /** 当前请求的 customerId */
    async currentCustomerId(ctx) {
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.UserInputError('No customer for the current user');
        }
        return customer.id;
    }
    /** 券商城目录：可售模板（渠道含 SALE 且 salePrice>0）+ 启用券包 */
    async saleCatalogue(ctx, scene) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const all = await repo.find({ relations: { channels: true } });
        const effectiveScene = (scene !== null && scene !== void 0 ? scene : 'ONLINE');
        const saleable = (0, coupon_sale_1.filterSaleCatalogue)((0, coupon_channel_1.filterTemplatesByChannelAndScene)(all, 'SALE', effectiveScene)).filter(t => t.enabled);
        const bundleRepo = this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundle);
        const bundles = await bundleRepo.find({
            where: { enabled: true, channelId: ctx.channelId },
            order: { id: 'DESC' },
        });
        return { templates: saleable, bundles };
    }
    /** 创建出售单（路径 A）：校验渠道含 SALE / 可售 / 未售罄，落 PENDING 单 */
    async createSaleOrder(ctx, templateId, bundleId) {
        if (!templateId && !bundleId) {
            throw new core_1.UserInputError('templateId or bundleId is required');
        }
        if (templateId && bundleId) {
            throw new core_1.UserInputError('Only one of templateId / bundleId is allowed');
        }
        const customerId = await this.currentCustomerId(ctx);
        let amount = 0;
        if (templateId) {
            const tpl = await this.loadSaleableTemplate(ctx, templateId);
            amount = tpl.salePrice;
        }
        else {
            const { bundle, items } = await this.loadSaleableBundle(ctx, bundleId);
            this.assertBundleStock(items);
            amount = bundle.salePrice;
        }
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        return repo.save(new coupon_sale_order_entity_1.CouponSaleOrder({
            customerId,
            payMode: 'WECHAT',
            templateId: templateId ? Number(templateId) : null,
            bundleId: bundleId ? Number(bundleId) : null,
            orderId: null,
            surchargeId: null,
            amount,
            status: 'PENDING',
            paymentMethod: null,
            externalRef: null,
            remark: null,
            channelId: ctx.channelId,
        }));
    }
    /** 余额支付（同步结算）：扣余额 → 置 PAID → 发券 */
    async paySaleOrderWithBalance(ctx, id) {
        const port = (0, coupon_balance_port_1.getCouponBalancePort)();
        if (!port) {
            throw new core_1.UserInputError('Balance payment is not available');
        }
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const order = await this.loadOwnedPendingOrder(ctx, id);
        await port.deductBalance(ctx, order.customerId, order.amount);
        order.paymentMethod = 'balance';
        await repo.save(order);
        await this.settleSaleOrder(ctx, order.id);
        const fresh = await repo.findOne({ where: { id: order.id } });
        return fresh;
    }
    /** 生成微信支付参数（仅本人 PENDING 单），镜像 recharge-card 的 RC- 范式 */
    async createWechatCouponPayment(ctx, saleOrderId, tradeType, openid) {
        const order = await this.loadOwnedPendingOrder(ctx, saleOrderId);
        if (!gatewayService) {
            throw new core_1.UserInputError('Payment gateway not configured');
        }
        const outTradeNo = `CS-${order.id}`;
        const effectiveTradeType = tradeType || 'JSAPI';
        const effectiveOpenid = openid ||
            (await (0, wechatpay_plugin_1.resolveCustomerOpenid)(ctx, order.customerId, {
                preferMini: effectiveTradeType === 'JSAPI',
            }));
        const pay = await gatewayService.createBarePayment({
            outTradeNo,
            amount: order.amount,
            tradeType: effectiveTradeType,
            openid: effectiveOpenid,
            description: `Coupon ${outTradeNo}`,
        });
        order.paymentMethod = 'wechatpay';
        order.externalRef = outTradeNo;
        await this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder).save(order);
        return { saleOrderId: order.id, outTradeNo, pay };
    }
    /** 微信回调结算入口：解析 CS-<id>，原子置 PAID 后发券（幂等） */
    async settleCouponSaleOrderByOutTradeNo(ctx, outTradeNo) {
        var _a;
        const m = String(outTradeNo).match(/^CS-(\d+)$/);
        if (!m) {
            throw new core_1.UserInputError('Invalid coupon sale out_trade_no');
        }
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const order = await repo.findOne({
            where: { id: m[1], channelId: ctx.channelId },
        });
        if (!order) {
            throw new core_1.UserInputError('Coupon sale order not found');
        }
        if (order.status !== 'PENDING') {
            return; // 幂等：已结算直接返回
        }
        await this.connection.startTransaction(ctx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(coupon_sale_order_entity_1.CouponSaleOrder)
                .set({ status: 'PAID', paidAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PENDING' })
                .execute();
            if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return; // 并发下已被他人结算
            }
            await this.issueCouponsForOrder(ctx, order);
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    /** 取消未支付出售单 */
    async cancelSaleOrder(ctx, id) {
        const order = await this.loadOwnedPendingOrder(ctx, id);
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        order.status = 'CANCELLED';
        return repo.save(order);
    }
    /**
     * 退款回收（路径 A：微信 / 余额）：券全部未使用才可退。
     * 回收券（INVALID）+ 单据 REFUNDED + 余额补偿（微信/余额支付均已入客户余额，见 §16-2 决策）。
     */
    async refundSaleOrder(ctx, id, reason) {
        var _a;
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const order = await repo.findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        if (!order) {
            throw new core_1.UserInputError('Coupon sale order not found');
        }
        if (order.payMode === 'ORDER_SURCHARGE') {
            throw new core_1.UserInputError('Please refund the main order instead');
        }
        if (order.status !== 'PAID') {
            throw new core_1.UserInputError(`Coupon sale order is ${order.status}`);
        }
        const coupons = await this.loadSaleCoupons(ctx, order.id);
        if (!(0, coupon_sale_1.isSaleOrderRefundable)(coupons.map(c => c.status))) {
            throw new core_1.UserInputError('Coupon already used, refund rejected');
        }
        const port = (0, coupon_balance_port_1.getCouponBalancePort)();
        if (!port) {
            throw new core_1.UserInputError('Balance refund is not available');
        }
        await this.connection.startTransaction(ctx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(coupon_sale_order_entity_1.CouponSaleOrder)
                .set({ status: 'REFUNDED', refundedAt: new Date(), remark: reason !== null && reason !== void 0 ? reason : order.remark })
                .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                .execute();
            if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
                throw new core_1.UserInputError('Coupon sale order is not refundable now');
            }
            await this.invalidateCoupons(ctx, order.id);
            await port.addBalance(ctx, order.customerId, order.amount);
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
        return (await repo.findOne({ where: { id: order.id } }));
    }
    /** 我的出售单 */
    async mySaleOrders(ctx) {
        const customerId = await this.currentCustomerId(ctx);
        return this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder).find({
            where: { customerId, channelId: ctx.channelId },
            order: { id: 'DESC' },
        });
    }
    // ===== 加价购（路径 B）=====
    /**
     * 商品页加价购：把券价作为 Surcharge 挂到主订单，落 PENDING 出售单。
     * orderId 必须是本人的活动订单。同一 orderId + templateId 只允许一条 PENDING。
     */
    async attachCouponToOrder(ctx, orderId, templateId, orderService) {
        var _a, _b;
        const customerId = await this.currentCustomerId(ctx);
        const tpl = await this.loadSaleableTemplate(ctx, templateId);
        if (!(0, coupon_channel_1.matchesScene)(tpl.usageScene, 'ONLINE')) {
            throw new core_1.UserInputError('Coupon is not available for online orders');
        }
        const order = await orderService.getOrderOrThrow(ctx, orderId);
        const orderCustomerId = (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : order.customerId;
        if (String(orderCustomerId) !== String(customerId)) {
            throw new core_1.UserInputError('Order does not belong to the current customer');
        }
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const existing = await repo.findOne({
            where: {
                orderId: Number(orderId),
                templateId: Number(templateId),
                status: 'PENDING',
                channelId: ctx.channelId,
            },
        });
        if (existing) {
            throw new core_1.UserInputError('Coupon already attached to this order');
        }
        const updated = await orderService.addSurchargeToOrder(ctx, orderId, {
            description: `Coupon surcharge #${templateId}`,
            listPrice: tpl.salePrice,
            listPriceIncludesTax: ctx.channel.pricesIncludeTax,
        });
        const surcharge = updated.surcharges[updated.surcharges.length - 1];
        return repo.save(new coupon_sale_order_entity_1.CouponSaleOrder({
            customerId,
            payMode: 'ORDER_SURCHARGE',
            templateId: Number(templateId),
            bundleId: null,
            orderId: Number(orderId),
            surchargeId: surcharge ? Number(surcharge.id) : null,
            amount: tpl.salePrice,
            status: 'PENDING',
            paymentMethod: null,
            externalRef: null,
            remark: null,
            channelId: ctx.channelId,
        }));
    }
    /** 摘除加价购：移除 Surcharge + 置 CANCELLED */
    async detachCouponFromOrder(ctx, orderId, templateId, orderService) {
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const order = await repo.findOne({
            where: {
                orderId: Number(orderId),
                templateId: Number(templateId),
                status: 'PENDING',
                channelId: ctx.channelId,
            },
        });
        if (!order) {
            return false;
        }
        if (order.surchargeId != null) {
            await orderService.removeSurchargeFromOrder(ctx, orderId, order.surchargeId);
        }
        order.status = 'CANCELLED';
        await repo.save(order);
        return true;
    }
    /**
     * 主订单支付成功 → 结算全部 PENDING 加价购单（幂等）。
     * 由 plugin.ts 订阅 OrderStateTransitionEvent(toState='PaymentSettled') 调用。
     */
    async settleSurchargeOrdersForOrder(ctx, orderId) {
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const orders = await repo.find({
            where: {
                orderId: Number(orderId),
                payMode: 'ORDER_SURCHARGE',
                status: 'PENDING',
            },
        });
        for (const order of orders) {
            await this.settleSaleOrderWithTx(ctx, order);
        }
    }
    /**
     * 主订单整单退款/取消 → 回收加价购券并置 REFUNDED（钱随主订单退回，不做余额补偿）。
     */
    async refundSurchargeOrdersForOrder(ctx, orderId) {
        var _a;
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const orders = await repo.find({
            where: {
                orderId: Number(orderId),
                payMode: 'ORDER_SURCHARGE',
                status: 'PAID',
            },
        });
        for (const order of orders) {
            await this.connection.startTransaction(ctx);
            try {
                const claim = await repo
                    .createQueryBuilder()
                    .update(coupon_sale_order_entity_1.CouponSaleOrder)
                    .set({ status: 'REFUNDED', refundedAt: new Date() })
                    .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                    .execute();
                if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
                    await this.connection.commitOpenTransaction(ctx);
                    continue;
                }
                await this.invalidateCoupons(ctx, order.id);
                await this.connection.commitOpenTransaction(ctx);
            }
            catch (e) {
                await this.connection.rollBackTransaction(ctx);
                throw e;
            }
        }
    }
    // ===== 券包（admin + 购买编排）=====
    async listBundles(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, coupon_bundle_entity_1.CouponBundle)
            .createQueryBuilder('b')
            .where('b.channelId = :channelId', { channelId: Number(ctx.channelId) });
        qb.orderBy('b.id', 'DESC');
        qb.skip(Math.max(0, (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0)).take(Math.min((_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findBundle(ctx, id) {
        const found = await this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundle).findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        return found !== null && found !== void 0 ? found : undefined;
    }
    async listBundleItems(ctx, bundleId) {
        return this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundleItem).find({
            where: { bundleId: Number(bundleId) },
            order: { id: 'ASC' },
        });
    }
    /** 创建/更新券包（仅管理当前渠道） */
    async saveBundle(ctx, input, id) {
        var _a, _b, _c, _d;
        const repo = this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundle);
        const bundle = id != null
            ? await repo.findOne({ where: { id: id, channelId: ctx.channelId } })
            : new coupon_bundle_entity_1.CouponBundle({ channelId: ctx.channelId });
        if (!bundle) {
            throw new core_1.UserInputError('Coupon bundle not found');
        }
        const salePrice = Math.floor(Number((_a = input === null || input === void 0 ? void 0 : input.salePrice) !== null && _a !== void 0 ? _a : 0));
        if (!Number.isFinite(salePrice) || salePrice <= 0) {
            throw new core_1.UserInputError('salePrice must be a positive integer (cents)');
        }
        bundle.name = (_b = input === null || input === void 0 ? void 0 : input.name) !== null && _b !== void 0 ? _b : bundle.name;
        if ((input === null || input === void 0 ? void 0 : input.description) !== undefined) {
            bundle.description = (_c = input.description) !== null && _c !== void 0 ? _c : undefined;
        }
        bundle.salePrice = salePrice;
        if ((input === null || input === void 0 ? void 0 : input.enabled) !== undefined) {
            bundle.enabled = !!input.enabled;
        }
        if ((input === null || input === void 0 ? void 0 : input.shopId) !== undefined) {
            bundle.shopId = input.shopId == null ? null : Number(input.shopId);
        }
        const saved = await repo.save(bundle);
        if (Array.isArray(input === null || input === void 0 ? void 0 : input.items)) {
            const itemRepo = this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundleItem);
            await itemRepo.delete({ bundleId: saved.id });
            for (const raw of input.items) {
                const templateId = Number(raw === null || raw === void 0 ? void 0 : raw.templateId);
                if (!Number.isFinite(templateId)) {
                    throw new core_1.UserInputError('items[].templateId is required');
                }
                const qty = Math.max(1, Math.floor(Number((_d = raw === null || raw === void 0 ? void 0 : raw.quantity) !== null && _d !== void 0 ? _d : 1)) || 1);
                await itemRepo.save(new coupon_bundle_entity_1.CouponBundleItem({ bundleId: saved.id, templateId, quantity: qty }));
            }
        }
        return saved;
    }
    async deleteBundle(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundle);
        const bundle = await repo.findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        if (!bundle) {
            return false;
        }
        await this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundleItem).delete({ bundleId: bundle.id });
        await repo.remove(bundle);
        return true;
    }
    /** admin 出售单流水（列表 + 单查） */
    async listSaleOrders(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder)
            .createQueryBuilder('s')
            .where('s.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (options === null || options === void 0 ? void 0 : options.status) {
            qb.andWhere('s.status = :status', { status: options.status });
        }
        qb.orderBy('s.id', 'DESC');
        qb.skip(Math.max(0, (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0)).take(Math.min((_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findSaleOrder(ctx, id) {
        const found = await this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder).findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        return found !== null && found !== void 0 ? found : undefined;
    }
    // ===== 内部：加载与校验 =====
    async loadSaleableTemplate(ctx, templateId) {
        var _a;
        const tpl = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).findOne({
            where: { id: templateId },
            relations: { channels: true },
        });
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate ${templateId} not found`);
        }
        if (!tpl.enabled) {
            throw new core_1.UserInputError('Coupon template is disabled');
        }
        if (!(0, coupon_channel_1.hasChannel)(tpl, false, 'SALE')) {
            throw new core_1.UserInputError('Coupon is not for sale');
        }
        if (!this.couponService.templateBelongsToChannel(ctx, tpl)) {
            throw new core_1.UserInputError('Coupon is not available in this shop');
        }
        if (Number((_a = tpl.salePrice) !== null && _a !== void 0 ? _a : 0) <= 0) {
            throw new core_1.UserInputError('Coupon has no sale price');
        }
        if (tpl.totalCount > 0 && tpl.claimedCount >= tpl.totalCount) {
            throw new core_1.UserInputError('Coupon sold out');
        }
        return tpl;
    }
    async loadSaleableBundle(ctx, bundleId) {
        var _a;
        const bundle = await this.findBundle(ctx, bundleId);
        if (!bundle || !bundle.enabled) {
            throw new core_1.UserInputError('Coupon bundle not found');
        }
        if (Number((_a = bundle.salePrice) !== null && _a !== void 0 ? _a : 0) <= 0) {
            throw new core_1.UserInputError('Coupon bundle has no sale price');
        }
        const items = await this.listBundleItems(ctx, bundleId);
        if (items.length === 0) {
            throw new core_1.UserInputError('Coupon bundle is empty');
        }
        return { bundle, items };
    }
    async assertBundleStock(items) {
        // 无法 bundle 内模板一次性带 ctx 精查（省 IO 由发券时的原子扣减兜底），此处仅确认模板存在且启用
        const repo = this.connection.rawConnection.getRepository(coupon_template_entity_1.CouponTemplate);
        for (const item of items) {
            const tpl = await repo.findOne({ where: { id: item.templateId } });
            if (!tpl || !tpl.enabled) {
                throw new core_1.UserInputError(`Bundle template ${item.templateId} is not available`);
            }
        }
    }
    async loadOwnedPendingOrder(ctx, id) {
        const customerId = await this.currentCustomerId(ctx);
        const order = await this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder).findOne({
            where: { id: id, customerId, channelId: ctx.channelId },
        });
        if (!order) {
            throw new core_1.UserInputError('Coupon sale order not found');
        }
        if (order.status !== 'PENDING') {
            throw new core_1.UserInputError(`Coupon sale order is ${order.status}`);
        }
        return order;
    }
    async loadSaleCoupons(ctx, saleOrderId) {
        return this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon).find({
            where: { saleOrderId },
            order: { id: 'ASC' },
        });
    }
    /** 结算 + 发券（自带事务；供余额支付与加价购复用） */
    async settleSaleOrderWithTx(ctx, order) {
        var _a;
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        await this.connection.startTransaction(ctx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(coupon_sale_order_entity_1.CouponSaleOrder)
                .set({ status: 'PAID', paidAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PENDING' })
                .execute();
            if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return;
            }
            await this.issueCouponsForOrder(ctx, order);
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    /** 余额支付：已在事务内的结算（避免嵌套问题，直接发券） */
    async settleSaleOrder(ctx, saleOrderId) {
        var _a;
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const order = await repo.findOne({ where: { id: saleOrderId } });
        if (!order) {
            throw new core_1.UserInputError('Coupon sale order not found');
        }
        await this.issueCouponsForOrder(ctx, order);
        order.status = 'PAID';
        order.paidAt = (_a = order.paidAt) !== null && _a !== void 0 ? _a : new Date();
        await repo.save(order);
    }
    /** 按出售单发券：单券 1 张 / 券包按 item 展开逐张签发 */
    async issueCouponsForOrder(ctx, order) {
        if (order.templateId != null) {
            const tpl = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).findOne({
                where: { id: order.templateId },
            });
            if (!tpl) {
                throw new core_1.UserInputError(`CouponTemplate ${order.templateId} not found`);
            }
            await this.couponService.issueForSale(ctx, order.customerId, tpl, order.id);
            return;
        }
        if (order.bundleId != null) {
            const items = await this.listBundleItems(ctx, order.bundleId);
            const sequences = (0, coupon_sale_1.expandBundleItems)(items);
            for (const templateId of sequences) {
                const tpl = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).findOne({
                    where: { id: templateId },
                });
                if (!tpl) {
                    throw new core_1.UserInputError(`CouponTemplate ${templateId} not found`);
                }
                await this.couponService.issueForSale(ctx, order.customerId, tpl, order.id);
            }
            return;
        }
        throw new core_1.UserInputError('Coupon sale order has neither templateId nor bundleId');
    }
    async invalidateCoupons(ctx, saleOrderId) {
        await this.connection
            .getRepository(ctx, customer_coupon_entity_1.CustomerCoupon)
            .createQueryBuilder()
            .update(customer_coupon_entity_1.CustomerCoupon)
            .set({ status: 'INVALID' })
            .where('saleOrderId = :saleOrderId AND status IN (:...statuses)', {
            saleOrderId,
            statuses: ['UNUSED', 'RETURNED', 'EXPIRED'],
        })
            .execute();
    }
};
exports.CouponSaleService = CouponSaleService;
exports.CouponSaleService = CouponSaleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        coupon_service_1.CouponService,
        core_1.CustomerService])
], CouponSaleService);
//# sourceMappingURL=coupon-sale.service.js.map