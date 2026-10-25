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
const coupon_settlement_service_1 = require("./coupon-settlement.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const coupon_sale_order_entity_1 = require("./coupon-sale-order.entity");
const coupon_bundle_entity_1 = require("./coupon-bundle.entity");
const coupon_sale_1 = require("./coupon-sale");
const coupon_channel_1 = require("./coupon-channel");
const coupon_sale_regulatory_1 = require("./coupon-sale-regulatory");
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
    constructor(connection, couponService, customerService, settlementService, channelService) {
        this.connection = connection;
        this.couponService = couponService;
        this.customerService = customerService;
        this.settlementService = settlementService;
        this.channelService = channelService;
    }
    /** 当前请求的 customerId */
    async currentCustomerId(ctx) {
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.UserInputError('No customer for the current user');
        }
        return customer.id;
    }
    /** 券商城目录：可售模板（渠道含 SALE 且 salePrice>0）+ 启用券包；附真实已售数、首购/学生价资格信息与倒计时活动位 */
    async saleCatalogue(ctx, scene) {
        var _a, _b, _c, _d, _e, _f;
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const all = await repo.find({ relations: { channels: true } });
        const effectiveScene = (scene !== null && scene !== void 0 ? scene : 'ONLINE');
        // 渠道归属校验：与 loadSaleableTemplate 同口径，别家店的券不进本店目录
        // （channels 为空的平台券视为不限渠道，仍然全店可见可购）
        const saleable = (0, coupon_sale_1.filterSaleCatalogue)((0, coupon_channel_1.filterTemplatesByChannelAndScene)(all, 'SALE', effectiveScene)).filter(t => t.enabled && this.couponService.templateBelongsToChannel(ctx, t));
        const bundleRepo = this.connection.getRepository(ctx, coupon_bundle_entity_1.CouponBundle);
        const bundles = await bundleRepo.find({
            where: { enabled: true, channelId: ctx.channelId },
            order: { id: 'DESC' },
        });
        // 真实已售数：按渠道统计已支付（PAID）出售单——单券按 templateId、券包按 bundleId
        // 分组计数。退款单（REFUNDED）/取消单不计入，保证「已售N」为真实成交口径。
        const saleOrderRepo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const [tplRows, bundleRows] = await Promise.all([
            saleOrderRepo
                .createQueryBuilder('s')
                .select('s.templateId', 'templateId')
                .addSelect('COUNT(*)', 'cnt')
                .where('s.channelId = :channelId AND s.status = :status AND s.templateId IS NOT NULL', { channelId: ctx.channelId, status: 'PAID' })
                .groupBy('s.templateId')
                .getRawMany(),
            saleOrderRepo
                .createQueryBuilder('s')
                .select('s.bundleId', 'bundleId')
                .addSelect('COUNT(*)', 'cnt')
                .where('s.channelId = :channelId AND s.status = :status AND s.bundleId IS NOT NULL', { channelId: ctx.channelId, status: 'PAID' })
                .groupBy('s.bundleId')
                .getRawMany(),
        ]);
        const tplSold = new Map(tplRows.map(r => [Number(r.templateId), Number(r.cnt)]));
        const bundleSold = new Map(bundleRows.map(r => [Number(r.bundleId), Number(r.cnt)]));
        for (const t of saleable) {
            t.soldCount = (_a = tplSold.get(Number(t.id))) !== null && _a !== void 0 ? _a : 0;
        }
        for (const b of bundles) {
            b.soldCount = (_b = bundleSold.get(Number(b.id))) !== null && _b !== void 0 ? _b : 0;
        }
        // 首购立减/学生价目录信息：firstBuyDiscount 渠道级（0/null=关闭）；
        // firstBuyEligible / studentApproved 仅登录态计算（匿名 null，由 C 端按新客展示引导）
        const channelRepo = this.connection.getRepository(ctx, core_1.Channel);
        const channel = await channelRepo.findOne({ where: { id: ctx.channelId } });
        const firstBuyDiscount = Math.max(0, Math.floor(Number((_d = (_c = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _c === void 0 ? void 0 : _c.firstBuyDiscount) !== null && _d !== void 0 ? _d : 0)));
        const customerId = await this.currentCustomerId(ctx).catch(() => null);
        let firstBuyEligible = null;
        let studentApproved = null;
        if (customerId) {
            firstBuyEligible = await this.isFirstBuyEligible(ctx, customerId);
            const customer = await this.connection
                .getRepository(ctx, core_1.Customer)
                .findOne({ where: { id: customerId } });
            studentApproved =
                ((_e = customer === null || customer === void 0 ? void 0 : customer.customFields) === null || _e === void 0 ? void 0 : _e.studentStatus) === 'approved';
        }
        // E2 会员等级可见性过滤：配置等级门槛的券，低等级/无等级（含匿名）不进本店目录
        const visibleTemplates = await this.couponService.filterByMemberLevelVisibility(ctx, saleable);
        // 倒计时活动位（单场）：enabled + 服务端时间窗 + 关联券命中本店可售目录；无活动为 null
        const campaignRaw = (_f = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _f === void 0 ? void 0 : _f.couponCampaign;
        let campaign = (0, coupon_sale_1.resolveActiveCampaign)(campaignRaw, visibleTemplates, new Date(), ctx.languageCode);
        // FR-D 新客 1 元购位：newCustomerOnly 时——仅保留有余量的券（全无余量整位摘除）；
        // 已登录非新客不下发（匿名保留，登录购买时后端再硬拦）。
        const campaignCfg = (0, coupon_sale_1.parseCouponCampaignConfig)(campaignRaw);
        if (campaign && (campaignCfg === null || campaignCfg === void 0 ? void 0 : campaignCfg.newCustomerOnly)) {
            const inStock = visibleTemplates.filter(t => !(t.totalCount > 0 && t.claimedCount >= t.totalCount));
            campaign = (0, coupon_sale_1.resolveActiveCampaign)(campaignRaw, inStock, new Date(), ctx.languageCode);
            if (campaign && customerId && !(await this.couponService.isCampaignNewCustomer(ctx, customerId))) {
                campaign = null;
            }
        }
        return {
            templates: visibleTemplates,
            bundles,
            firstBuyDiscount,
            firstBuyEligible,
            studentApproved,
            campaign,
        };
    }
    /** 首购资格：本渠道无已支付（PAID）出售单 → true（每用户仅 1 次；取消/退款单不占资格） */
    async isFirstBuyEligible(ctx, customerId) {
        const cnt = await this.connection
            .getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder)
            .createQueryBuilder('s')
            .where('s.customerId = :cid AND s.channelId = :ch AND s.status = :st', {
            cid: customerId,
            ch: ctx.channelId,
            st: 'PAID',
        })
            .getCount();
        return cnt === 0;
    }
    /** 创建出售单（路径 A）：校验渠道含 SALE / 可售 / 未售罄，落 PENDING 单 */
    async createSaleOrder(ctx, templateId, bundleId) {
        var _a, _b, _c;
        if (!templateId && !bundleId) {
            throw new core_1.UserInputError('templateId or bundleId is required');
        }
        if (templateId && bundleId) {
            throw new core_1.UserInputError('Only one of templateId / bundleId is allowed');
        }
        const customerId = await this.currentCustomerId(ctx);
        // 首购立减/学生价：渠道配置 + 用户资格 → 后端重算到手价（不信任前端）
        const channelRepo = this.connection.getRepository(ctx, core_1.Channel);
        const channel = await channelRepo.findOne({ where: { id: ctx.channelId } });
        const firstBuyDiscount = Math.max(0, Math.floor(Number((_b = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.firstBuyDiscount) !== null && _b !== void 0 ? _b : 0)));
        const firstBuyEligible = await this.isFirstBuyEligible(ctx, customerId);
        const customer = await this.connection.getRepository(ctx, core_1.Customer).findOne({ where: { id: customerId } });
        const studentApproved = ((_c = customer === null || customer === void 0 ? void 0 : customer.customFields) === null || _c === void 0 ? void 0 : _c.studentStatus) === 'approved';
        let amount = 0;
        let tpl = null;
        // 监管参数组（T4）：默认宽松（未配置不校验），配置后才硬拦
        const limits = (0, coupon_sale_regulatory_1.extractBillpayLimits)(channel);
        if (templateId) {
            tpl = await this.loadSaleableTemplate(ctx, templateId);
            // FR-D：新客券（newCustomerOnly）非新客/重复购买硬拦；E2：等级门槛不达标硬拦
            await this.couponService.assertCustomerCanBuy(ctx, customerId, tpl);
            (0, coupon_sale_regulatory_1.assertTemplateWithinRegulatoryLimits)(tpl, limits);
            amount = tpl.salePrice;
        }
        else {
            const { bundle, items } = await this.loadSaleableBundle(ctx, bundleId);
            const itemTemplates = await this.assertBundleStock(items);
            (0, coupon_sale_regulatory_1.assertBundleWithinRegulatoryLimits)(bundle.salePrice, itemTemplates, items.map(i => i.quantity), limits);
            amount = bundle.salePrice;
        }
        const promo = (0, coupon_sale_1.resolvePromoPrice)(amount, {
            studentPrice: tpl === null || tpl === void 0 ? void 0 : tpl.studentPrice,
            studentApproved,
            firstBuyEligible,
            firstBuyDiscount,
        });
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        return repo.save(new coupon_sale_order_entity_1.CouponSaleOrder({
            customerId,
            payMode: 'WECHAT',
            templateId: templateId ? Number(templateId) : null,
            bundleId: bundleId ? Number(bundleId) : null,
            orderId: null,
            surchargeId: null,
            amount: promo.final,
            discountType: promo.discountType,
            discountAmount: promo.discountAmount,
            status: 'PENDING',
            paymentMethod: null,
            externalRef: null,
            remark: null,
            channelId: ctx.channelId,
        }));
    }
    /** 余额支付（同步结算）：先发券 + 置 PAID，再扣款；扣款内部提交事务，三者一并落库 */
    async paySaleOrderWithBalance(ctx, id) {
        var _a;
        const port = (0, coupon_balance_port_1.getCouponBalancePort)();
        if (!port) {
            throw new core_1.UserInputError('Balance payment is not available');
        }
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const order = await this.loadOwnedPendingOrder(ctx, id);
        // 顺序不可颠倒：deductBalance 内部会 commitOpenTransaction（提前提交外层事务），
        // 所以必须先把「发券 + 置 PAID」做完再扣款提交。这样任一步失败（券包某张售罄、余额不足）
        // 都只是回滚外层事务，不会出现「已扣款却只发了一半券」的半成品状态。
        await this.issueCouponsForOrder(ctx, order);
        order.paymentMethod = 'balance';
        order.payMode = 'BALANCE';
        order.status = 'PAID';
        order.paidAt = (_a = order.paidAt) !== null && _a !== void 0 ? _a : new Date();
        await repo.save(order);
        await port.deductBalance(ctx, order.customerId, order.amount);
        const fresh = await repo.findOne({ where: { id: order.id } });
        return fresh;
    }
    /** 生成微信支付参数（仅本人 PENDING 单），镜像 recharge-card 的 RC- 范式 */
    async createWechatCouponPayment(ctx, saleOrderId, tradeType, openid) {
        const order = await this.loadOwnedPendingOrder(ctx, saleOrderId);
        if (!gatewayService) {
            throw new core_1.UserInputError('Payment gateway not configured');
        }
        // 微信要求 out_trade_no 至少 6 位（6~32）：小 id 的 `CS-30` 会被拒为「商户订单号错误」，
        // 故数字段左补零到 6 位；回调解析 /^CS-(\d+)$/ 不受影响。
        const outTradeNo = `CS-${String(order.id).padStart(6, '0')}`;
        const effectiveTradeType = tradeType || 'JSAPI';
        const effectiveOpenid = openid ||
            (await (0, wechatpay_plugin_1.resolveCustomerOpenid)(ctx, order.customerId, {
                // 渠道配了 payConfig.wechatpay（自带公众号商户参数）时是公众号/H5 支付，
                // 必须取公众号 openid；否则双 openid 客户会拿小程序 openid 配公众号 appid，
                // 微信直接报「openid 和 appid 不匹配」。无渠道配置时沿用小程序优先。
                preferMini: effectiveTradeType === 'JSAPI' && !gatewayService.hasChannelPayConfig(ctx),
            }));
        const pay = await gatewayService.createBarePayment({
            outTradeNo,
            amount: order.amount,
            tradeType: effectiveTradeType,
            openid: effectiveOpenid,
            description: `Coupon ${outTradeNo}`,
        }, ctx);
        order.paymentMethod = 'wechatpay';
        order.externalRef = outTradeNo;
        await this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder).save(order);
        return { saleOrderId: order.id, outTradeNo, pay };
    }
    /** 微信回调结算入口：解析 CS-<id>，原子置 PAID 后发券（幂等）。
     *  回调 Host 决定验签 ctx（多租户共用主域名时会落到默认渠道），而券售单归属自有渠道，
     *  故不按 ctx.channelId 过滤；命中后切到订单所在渠道再发券（券包/模板按渠道隔离）。 */
    async settleCouponSaleOrderByOutTradeNo(ctx, outTradeNo) {
        var _a;
        const m = String(outTradeNo).match(/^CS-(\d+)$/);
        if (!m) {
            throw new core_1.UserInputError('Invalid coupon sale out_trade_no');
        }
        const order = await this.connection
            .getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder)
            .findOne({ where: { id: Number(m[1]) } });
        if (!order) {
            throw new core_1.UserInputError('Coupon sale order not found');
        }
        if (order.status !== 'PENDING') {
            return; // 幂等：已结算直接返回
        }
        const orderCtx = await this.orderChannelCtx(ctx, order.channelId);
        const repo = this.connection.getRepository(orderCtx, coupon_sale_order_entity_1.CouponSaleOrder);
        await this.connection.startTransaction(orderCtx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(coupon_sale_order_entity_1.CouponSaleOrder)
                .set({ status: 'PAID', paidAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PENDING' })
                .execute();
            if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
                await this.connection.commitOpenTransaction(orderCtx);
                return; // 并发下已被他人结算
            }
            await this.issueCouponsForOrder(orderCtx, order);
            await this.connection.commitOpenTransaction(orderCtx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(orderCtx);
            throw e;
        }
    }
    /** 订单所属渠道的 admin ctx（回调 ctx 的渠道可能与之不同） */
    async orderChannelCtx(ctx, channelId) {
        if (Number(channelId) === Number(ctx.channelId))
            return ctx;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel) {
            throw new core_1.UserInputError(`Channel ${channelId} of coupon sale order not found`);
        }
        return new core_1.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
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
        // T8 退款联动：结算单取消（PENDING）/追偿（SETTLED/PAID_OUT）；失败只记日志不阻断退款主流程
        await this.settlementService.onSaleOrderRefunded(ctx, order.id, reason);
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
        // FR-D/E2：加价购入口同样硬拦新客券与等级门槛
        await this.couponService.assertCustomerCanBuy(ctx, customerId, tpl);
        if (!(0, coupon_channel_1.matchesScene)(tpl.usageScene, 'ONLINE')) {
            throw new core_1.UserInputError('Coupon is not available for online orders');
        }
        // 监管参数组（T4）：加价购入口同样受限（默认宽松，配置后才校验）
        const channelRepo = this.connection.getRepository(ctx, core_1.Channel);
        const channel = await channelRepo.findOne({ where: { id: ctx.channelId } });
        (0, coupon_sale_regulatory_1.assertTemplateWithinRegulatoryLimits)(tpl, (0, coupon_sale_regulatory_1.extractBillpayLimits)(channel));
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
     * 同时把仍未支付（PENDING）的加价购单置 CANCELLED：主订单已取消，加价购意图随之作废。
     */
    async refundSurchargeOrdersForOrder(ctx, orderId) {
        var _a;
        const repo = this.connection.getRepository(ctx, coupon_sale_order_entity_1.CouponSaleOrder);
        const paidOrders = await repo.find({
            where: {
                orderId: Number(orderId),
                payMode: 'ORDER_SURCHARGE',
                status: 'PAID',
            },
        });
        for (const order of paidOrders) {
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
        // 未支付的加价购单：直接作废（无钱可退，无券可回收）
        await repo
            .createQueryBuilder()
            .update(coupon_sale_order_entity_1.CouponSaleOrder)
            .set({ status: 'CANCELLED' })
            .where('orderId = :orderId AND payMode = :payMode AND status = :status', {
            orderId: Number(orderId),
            payMode: 'ORDER_SURCHARGE',
            status: 'PENDING',
        })
            .execute();
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
        const templates = [];
        for (const item of items) {
            const tpl = await repo.findOne({ where: { id: item.templateId } });
            if (!tpl || !tpl.enabled) {
                throw new core_1.UserInputError(`Bundle template ${item.templateId} is not available`);
            }
            templates.push(tpl);
        }
        return templates;
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
        core_1.CustomerService,
        coupon_settlement_service_1.CouponSettlementService,
        core_1.ChannelService])
], CouponSaleService);
//# sourceMappingURL=coupon-sale.service.js.map