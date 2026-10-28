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
exports.BillPayService = void 0;
exports.setBillPayGateway = setBillPayGateway;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
const bill_pay_balance_port_1 = require("./bill-pay-balance-port");
const bill_pay_config_entity_1 = require("./bill-pay-config.entity");
const bill_pay_coupon_1 = require("./bill-pay-coupon");
const bill_pay_order_entity_1 = require("./bill-pay-order.entity");
const bill_pay_settlement_entity_1 = require("./bill-pay-settlement.entity");
const bill_pay_settlement_calc_1 = require("./bill-pay-settlement-calc");
const merchant_agreement_entity_1 = require("./merchant-agreement.entity");
const constants_1 = require("./constants");
const quote_engine_1 = require("./quote-engine");
const types_1 = require("./types");
/**
 * 进程内网关引用（镜像 coupon-sale.service.ts 的 setCouponSaleGateway 模式）：
 * 由 plugin.ts 启动时经 Injector 取到 WechatpayService 后注入；未装载 WechatpayPlugin 时为 null。
 */
let gatewayService = null;
function setBillPayGateway(gw) {
    gatewayService = gw;
}
const SETTABLE_STATUSES = [
    'PENDING_QUOTE',
    'QUOTED',
    'PAID',
    'IN_SERVICE',
    'COMPLETED',
    'SETTLED',
    'CANCELLED',
    'REFUNDED',
];
/**
 * 代买单编排服务：委托单状态机（设计文档 §3）+ 支付链路（§5）+ 台账结算（§10）。
 * 所有金额单位为「分」；单据不生成 Vendure Order，渠道隔离一律按 ctx.channelId。
 */
let BillPayService = class BillPayService {
    constructor(connection, customerService, channelService) {
        this.connection = connection;
        this.customerService = customerService;
        this.channelService = channelService;
    }
    // ===== 基础 =====
    async currentCustomerId(ctx) {
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.UserInputError('No customer for the current user');
        }
        return customer.id;
    }
    /** 渠道配置：bill_pay_config JSON → 解析（坏配置逐字段回退默认） */
    async getChannelConfig(ctx) {
        const repo = this.connection.getRepository(ctx, bill_pay_config_entity_1.BillPayChannelConfigEntity);
        const row = await repo.findOne({ where: { channelId: ctx.channelId } });
        if (!row) {
            return Object.assign({}, types_1.DEFAULT_BILLPAY_CONFIG);
        }
        return (0, quote_engine_1.parseBillPayConfig)(row.config);
    }
    /** 实体 → GraphQL 形态（discountDetail JSON 反序列化） */
    toGraph(order) {
        let discountDetail = null;
        if (order.discountDetail) {
            try {
                const parsed = JSON.parse(order.discountDetail);
                discountDetail = Array.isArray(parsed) ? parsed : order.discountDetail;
            }
            catch (_a) {
                discountDetail = order.discountDetail;
            }
        }
        return Object.assign(Object.assign({}, order), { discountDetail });
    }
    orderRepo(ctx) {
        return this.connection.getRepository(ctx, bill_pay_order_entity_1.BillPayOrder);
    }
    /** 惰性报价过期：QUOTED 超期 → 回 PENDING_QUOTE（读路径收敛，不依赖定时器） */
    async normalizeQuoteExpiry(ctx, order) {
        var _a, _b, _c;
        if (order.status === 'QUOTED' &&
            order.quoteExpireAt &&
            order.quoteExpireAt.getTime() < Date.now()) {
            const claim = await this.orderRepo(ctx)
                .createQueryBuilder()
                .update(bill_pay_order_entity_1.BillPayOrder)
                .set({ status: 'PENDING_QUOTE' })
                .where('id = :id AND status = :status', { id: order.id, status: 'QUOTED' })
                .execute();
            if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) > 0) {
                order.status = 'PENDING_QUOTE';
                if (order.couponCode) {
                    // 报价过期会回退人工报价，而人工改价会重写金额与明细、无法保留券抵扣；
                    // 此时释放券并清空券字段，避免「有券码无抵扣」的脏单把券永久锁死。
                    try {
                        await this.releaseCoupon(ctx, order);
                    }
                    catch (e) {
                        core_1.Logger.error(`BillPayOrder ${(_b = order.code) !== null && _b !== void 0 ? _b : order.id} quote expired but coupon ` +
                            `${order.couponCode} release failed: ${String((_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : '')}`, constants_1.loggerCtx);
                    }
                    order.couponCode = null;
                    order.couponDiscount = null;
                    await this.orderRepo(ctx).save(order);
                }
            }
        }
        return order;
    }
    async loadChannelOrder(ctx, id) {
        const order = await this.orderRepo(ctx).findOne({
            where: { id: id, channelId: ctx.channelId },
        });
        if (!order) {
            throw new core_1.UserInputError('Bill pay order not found');
        }
        return this.normalizeQuoteExpiry(ctx, order);
    }
    async loadOwnedOrder(ctx, id) {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.customerId !== (await this.currentCustomerId(ctx))) {
            throw new core_1.UserInputError('Bill pay order does not belong to the current customer');
        }
        return order;
    }
    applyQuoteFields(order, payable, discountDetail, expireMinutes) {
        order.quoteAmount = payable;
        order.discountDetail = JSON.stringify(discountDetail);
        order.quoteExpireAt = new Date(Date.now() + expireMinutes * 60000);
    }
    // ===== 客户侧 =====
    /**
     * 客户提交委托：限额校验（单笔 min + 单日累计）→ PENDING_QUOTE，autoQuote 命中即同步报价转 QUOTED
     * 商户关联：优先 merchantId，缺省按名称/编码解析；merchant-plugin 未装载时退回纯名称模式。
     */
    async createBillPayOrder(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _o, _p, _q;
        const customerId = await this.currentCustomerId(ctx);
        const merchantName = String((_a = input.merchantName) !== null && _a !== void 0 ? _a : '').trim();
        const merchant = await this.resolveMerchant(ctx, input.merchantId, merchantName);
        if (!merchantName && !merchant) {
            throw new core_1.UserInputError('merchantName is required');
        }
        const orderMerchantName = (merchant === null || merchant === void 0 ? void 0 : merchant.name) || merchantName;
        const expectedAmount = Math.round(Number(input.expectedAmount));
        const config = await this.getChannelConfig(ctx);
        if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
            throw new core_1.UserInputError('Invalid expectedAmount');
        }
        if (expectedAmount < config.minAmount) {
            throw new core_1.UserInputError(`Amount below minimum (${config.minAmount})`);
        }
        // 单日累计限额（合规 §13）：当日未取消/未退款单的应累计 + 本单预估 ≤ dailyLimitAmount
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const agg = await this.orderRepo(ctx)
            .createQueryBuilder('o')
            .select('COALESCE(SUM(COALESCE(o.quoteAmount, o.expectedAmount)), 0)', 'total')
            .where('o.customerId = :customerId AND o.channelId = :channelId', {
            customerId,
            channelId: ctx.channelId,
        })
            .andWhere('o.createdAt >= :start', { start: startOfDay })
            .andWhere('o.status NOT IN (:...excluded)', {
            excluded: ['CANCELLED', 'REFUNDED'],
        })
            .getRawOne();
        const todayTotal = Number((_b = agg === null || agg === void 0 ? void 0 : agg.total) !== null && _b !== void 0 ? _b : 0);
        if (todayTotal + expectedAmount > config.dailyLimitAmount) {
            throw new core_1.UserInputError('Daily bill pay limit exceeded');
        }
        const couponCode = ((_c = input.couponCode) === null || _c === void 0 ? void 0 : _c.trim()) || null;
        // 用券只能在自动报价路径完成：人工报价会重写 quoteAmount/discountDetail，
        // 已预占的券会落成「有券码无抵扣」的脏单，故券路径直接拒绝转人工场景。
        let couponPlan = null;
        if (couponCode) {
            if (config.couponEnabled !== true) {
                throw new core_1.UserInputError('Coupon not enabled for bill pay');
            }
            // 用券单强制商户归属：券是租户资产，不能让本租户券在未认领商户的买单上抵扣。
            // 普通买单保持原口径（仅校验存在/未删），避免未认领渠道整体不可用。
            if (!merchant) {
                throw new core_1.UserInputError('商家不存在，请从商家列表选择');
            }
            await this.assertMerchantClaimed(ctx, merchant.id);
            const couponOutcome = (0, quote_engine_1.quoteBill)(expectedAmount, config);
            if ((0, types_1.isQuoteRejected)(couponOutcome) || !config.autoQuote) {
                if ((0, types_1.isQuoteRejected)(couponOutcome) && couponOutcome.reason === 'BELOW_MIN') {
                    throw new core_1.UserInputError(`Amount below minimum (${config.minAmount})`);
                }
                if ((0, types_1.isQuoteRejected)(couponOutcome) && couponOutcome.reason === 'INVALID_AMOUNT') {
                    throw new core_1.UserInputError('Invalid expectedAmount');
                }
                throw new core_1.UserInputError('Coupon not supported for manual quote amount');
            }
            const couponRepo = this.connection.getRepository(ctx, coupon_plugin_1.CustomerCoupon);
            const cc = await couponRepo.findOne({
                where: { code: couponCode },
                relations: { template: { channels: true } },
            });
            // 统一文案：不区分他人的券/已用/过期，避免券码枚举泄露他人信息
            // RETURNED（退款回退）与平台其它链路一致，视为可用
            if (!cc ||
                cc.customerId !== customerId ||
                (cc.status !== 'UNUSED' && cc.status !== 'RETURNED') ||
                (cc.expiredAt && new Date(cc.expiredAt).getTime() <= Date.now())) {
                throw new core_1.UserInputError('Coupon is not applicable to bill pay');
            }
            const tpl = cc.template;
            const scene = (_d = tpl === null || tpl === void 0 ? void 0 : tpl.usageScene) !== null && _d !== void 0 ? _d : 'ONLINE';
            // 券模板是 ChannelAware：必须属于当前渠道，否则跨租户券码可在本店买单抵扣
            const inChannel = ((_e = tpl === null || tpl === void 0 ? void 0 : tpl.channels) !== null && _e !== void 0 ? _e : []).some((ch) => Number(ch.id) === Number(ctx.channelId));
            if (!tpl || !tpl.enabled || !inChannel || (scene !== 'IN_STORE' && scene !== 'ALL')) {
                throw new core_1.UserInputError('Coupon is not applicable to bill pay');
            }
            // 券限门店/商户使用时不能用于买单（买单场景没有门店维度，无法校验覆盖范围）
            if (((_f = tpl.storeCoverage) !== null && _f !== void 0 ? _f : 'ALL') !== 'ALL') {
                throw new core_1.UserInputError('该券限指定门店使用，不适用于买单');
            }
            // 门槛按商家账单原价判定，与到店核销口径一致；券只抵「报价后应付」，不叠加到原价上
            const computed = (0, coupon_plugin_1.computeInStoreBill)(tpl, expectedAmount);
            if (!computed.ok) {
                throw new core_1.UserInputError(coupon_plugin_1.IN_STORE_REASON_MESSAGES[computed.reason]);
            }
            const quote = (0, bill_pay_coupon_1.applyCouponToQuote)(couponOutcome, computed.discountAmount, tpl.name);
            // 以实际入明细的券额为准（打开保留 1 分应付后可能小于券面额），避免「券码有值、抵扣为 0」的白用券
            const discount = (_h = (_g = quote.discountDetail.filter((d) => d.rule === 'coupon').pop()) === null || _g === void 0 ? void 0 : _g.amount) !== null && _h !== void 0 ? _h : 0;
            if (discount <= 0) {
                throw new core_1.UserInputError('Coupon has no applicable amount for this order');
            }
            couponPlan = { cc, quote, discount };
        }
        const repo = this.orderRepo(ctx);
        let order = await repo.save(new bill_pay_order_entity_1.BillPayOrder({
            code: null,
            customerId,
            merchantName: orderMerchantName,
            merchantId: (_j = merchant === null || merchant === void 0 ? void 0 : merchant.id) !== null && _j !== void 0 ? _j : null,
            expectedAmount,
            quoteAmount: null,
            actualAmount: null,
            discountDetail: null,
            couponCode,
            couponDiscount: couponPlan ? couponPlan.discount : null,
            status: 'PENDING_QUOTE',
            remark: (_k = input.remark) !== null && _k !== void 0 ? _k : null,
            quoteNote: null,
            quoteExpireAt: null,
            proofUrl: null,
            payRef: null,
            paymentMethod: null,
            operatorId: null,
            settleLedgerId: null,
            channelId: ctx.channelId,
        }));
        if (!order.code) {
            order.code = `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`;
            order = await repo.save(order);
        }
        if (couponPlan) {
            // 先预占再落报价：并发同码下单时只有一单能占住券，另一单在报价落库前就被截断
            const reserve = await this.connection
                .getRepository(ctx, coupon_plugin_1.CustomerCoupon)
                .createQueryBuilder()
                .update(coupon_plugin_1.CustomerCoupon)
                .set({ reservedOrderId: (_l = order.code) !== null && _l !== void 0 ? _l : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}` })
                .where("id = :id AND status IN ('UNUSED', 'RETURNED') AND reservedOrderId IS NULL", {
                id: couponPlan.cc.id,
            })
                .execute();
            if (((_o = reserve.affected) !== null && _o !== void 0 ? _o : 0) === 0) {
                order.status = 'CANCELLED';
                await repo.save(order);
                throw new core_1.UserInputError('Coupon is already in use');
            }
            this.applyQuoteFields(order, couponPlan.quote.payable, couponPlan.quote.discountDetail, config.quoteExpireMinutes);
            order.status = 'QUOTED';
            order = await repo.save(order);
            core_1.Logger.info(`BillPayOrder ${(_p = order.code) !== null && _p !== void 0 ? _p : order.id} created with coupon ` +
                `${couponPlan.cc.code} (quote=${couponPlan.quote.payable}, couponDiscount=${couponPlan.discount})`, constants_1.loggerCtx);
            return order;
        }
        // 自动报价：金额区间内且 autoQuote → 同步报价转 QUOTED；超 maxAmount 转人工（保持 PENDING_QUOTE）
        const outcome = (0, quote_engine_1.quoteBill)(expectedAmount, config);
        if (config.autoQuote && !(0, types_1.isQuoteRejected)(outcome)) {
            this.applyQuoteFields(order, outcome.payable, outcome.discountDetail, config.quoteExpireMinutes);
            order.status = 'QUOTED';
            order = await repo.save(order);
        }
        else if ((0, types_1.isQuoteRejected)(outcome) && outcome.reason === 'INVALID_AMOUNT') {
            throw new core_1.UserInputError('Invalid expectedAmount');
        }
        core_1.Logger.info(`BillPayOrder ${order.code} created (status=${order.status}, quote=${(_q = order.quoteAmount) !== null && _q !== void 0 ? _q : '-'})`, constants_1.loggerCtx);
        return order;
    }
    /** 客户自助取消：仅 PENDING_QUOTE / QUOTED */
    async cancelBillPayOrder(ctx, id) {
        var _a, _b, _c;
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'PENDING_QUOTE' && order.status !== 'QUOTED') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, cannot cancel`);
        }
        order.status = 'CANCELLED';
        const saved = await this.orderRepo(ctx).save(order);
        try {
            await this.releaseCoupon(ctx, order);
        }
        catch (e) {
            // 取消失败于释放券会把券永久锁死，但不该阻断取消本身，记 error 供人工处理
            core_1.Logger.error(`BillPayOrder ${(_a = saved.code) !== null && _a !== void 0 ? _a : saved.id} cancelled but coupon ${(_b = order.couponCode) !== null && _b !== void 0 ? _b : '-'} release failed: ${String((_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : '')}`, constants_1.loggerCtx);
        }
        return saved;
    }
    /** 我的委托单 */
    async myBillPayOrders(ctx, statuses) {
        const customerId = await this.currentCustomerId(ctx);
        const qb = this.orderRepo(ctx)
            .createQueryBuilder('o')
            .where('o.customerId = :customerId AND o.channelId = :channelId', {
            customerId,
            channelId: ctx.channelId,
        });
        if (statuses && statuses.length) {
            qb.andWhere('o.status IN (:...statuses)', { statuses });
        }
        qb.orderBy('o.id', 'DESC');
        const rows = await qb.getMany();
        for (const row of rows) {
            await this.normalizeQuoteExpiry(ctx, row);
        }
        return rows;
    }
    async findOwnedBillPayOrder(ctx, id) {
        return this.loadOwnedOrder(ctx, id);
    }
    // ===== 支付 =====
    /** 生成微信支付参数（仅本人 QUOTED 未超期单），镜像 coupon-sale 的 CS- 范式，单号前缀 BP- */
    async createWechatBillPayment(ctx, id, tradeType, openid) {
        var _a;
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'QUOTED' || order.quoteAmount == null) {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, not payable`);
        }
        if (!gatewayService) {
            throw new core_1.UserInputError('Payment gateway not configured');
        }
        const gateway = gatewayService; // 收窄为不可空引用（闭包内使用不再触发 possibly null）
        // 微信要求 out_trade_no 至少 6 位（6~32）：小 id 的 `BP-30` 会被拒为「商户订单号错误」，
        // 故数字段左补零到 6 位；回调解析 /^BP-(\d+)$/ 不受影响。
        const rawRef = (_a = order.code) !== null && _a !== void 0 ? _a : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`;
        const outTradeNo = rawRef.replace(/^BP-(\d+)$/, (_m, d) => `BP-${String(Number(d)).padStart(6, '0')}`);
        const effectiveTradeType = tradeType || 'JSAPI';
        // 渠道配了商户凭证（payConfig override）= 公众号/H5 场景，JSAPI 必须优先公众号 openid，
        // 否则取到小程序 openid 时 appId 不一致（openid 按 appid 隔离），支付必然失败。
        const effectiveOpenid = openid ||
            (await (0, wechatpay_plugin_1.resolveCustomerOpenid)(ctx, order.customerId, {
                preferMini: effectiveTradeType === 'JSAPI' && !gateway.hasChannelPayConfig(ctx),
            }));
        const pay = await gateway.createBarePayment({
            outTradeNo,
            amount: order.quoteAmount,
            tradeType: effectiveTradeType,
            openid: effectiveOpenid,
            description: `BillPay ${outTradeNo}`,
        }, ctx);
        order.paymentMethod = 'wechatpay';
        order.payRef = outTradeNo;
        await this.orderRepo(ctx).save(order);
        return { billPayOrderId: order.id, outTradeNo, pay };
    }
    /** 微信回调结算入口：解析 BP-<id>，原子置 QUOTED → PAID（幂等，参照 coupon-sale L208-237） */
    async settleBillPayOrderByOutTradeNo(ctx, outTradeNo) {
        var _a, _b, _c;
        const m = String(outTradeNo).match(/^BP-(\d+)$/);
        if (!m) {
            throw new core_1.UserInputError('Invalid bill pay out_trade_no');
        }
        // 回调域名解析出的渠道未必是下单渠道（回调落默认渠道域名时），
        // 不能按 ctx.channelId 过滤，否则查不到单→已扣款不结单；先按 id 取单再切到订单自身渠道。
        const order = await this.orderRepo(ctx).findOne({
            where: { id: Number(m[1]) },
        });
        if (!order) {
            throw new core_1.UserInputError('Bill pay order not found');
        }
        if (order.status !== 'QUOTED') {
            return; // 幂等：已结算/已取消直接返回
        }
        const orderCtx = await this.orderChannelCtx(ctx, order.channelId);
        const repo = this.orderRepo(orderCtx);
        await this.connection.startTransaction(orderCtx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(bill_pay_order_entity_1.BillPayOrder)
                .set({ status: 'PAID', paidAt: new Date(), payRef: outTradeNo })
                .where('id = :id AND status = :status', { id: order.id, status: 'QUOTED' })
                .execute();
            if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
                await this.connection.commitOpenTransaction(orderCtx);
                return; // 并发下已被他人结算
            }
            // 与置 PAID 同事务核销券：券异常不阻断已到账的收款，只记日志供对账
            try {
                await this.redeemCoupon(orderCtx, order);
            }
            catch (e) {
                core_1.Logger.error(`BillPayOrder ${outTradeNo} paid but coupon ${(_b = order.couponCode) !== null && _b !== void 0 ? _b : '-'} redemption failed: ${String((_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : '')}`, constants_1.loggerCtx);
            }
            await this.connection.commitOpenTransaction(orderCtx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(orderCtx);
            throw e;
        }
        core_1.Logger.info(`BillPayOrder ${outTradeNo} settled via wechat callback`, constants_1.loggerCtx);
    }
    /** 账单支付单所属渠道的 admin ctx（回调 ctx 的渠道可能与之不同） */
    async orderChannelCtx(ctx, channelId) {
        if (Number(channelId) === Number(ctx.channelId))
            return ctx;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel) {
            throw new core_1.UserInputError(`Channel ${channelId} of bill pay order not found`);
        }
        return new core_1.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }
    /** 余额支付（同步结算）：原子认领 QUOTED → PAID，再扣余额；扣款失败回退单据状态，避免已付/未扣的脏单 */
    async payBillPayOrderWithBalance(ctx, id) {
        var _a, _b, _c, _d;
        const port = (0, bill_pay_balance_port_1.getBillPayBalancePort)();
        if (!port) {
            throw new core_1.UserInputError('Balance payment is not available');
        }
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'QUOTED' || order.quoteAmount == null) {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, not payable`);
        }
        const repo = this.orderRepo(ctx);
        // 原子认领：并发/双击只有一次成功，防止重复扣款
        const claim = await repo
            .createQueryBuilder()
            .update(bill_pay_order_entity_1.BillPayOrder)
            .set({ status: 'PAID', paidAt: new Date(), paymentMethod: 'balance', payRef: order.code })
            .where('id = :id AND status = :status AND customerId = :customerId', {
            id: order.id,
            status: 'QUOTED',
            customerId: order.customerId,
        })
            .execute();
        if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, not payable`);
        }
        try {
            // 0 元单（历史数据）无需扣款；新单已由报价侧保证至少 1 分应付
            if (order.quoteAmount > 0) {
                await port.deductBalance(ctx, order.customerId, order.quoteAmount);
            }
        }
        catch (e) {
            // 扣款失败即回到未支付，避免「显示已付但未扣款/未核销」；券仍由本单预占，可取消或重新支付
            await repo
                .createQueryBuilder()
                .update(bill_pay_order_entity_1.BillPayOrder)
                .set({ status: 'QUOTED', paidAt: null, paymentMethod: null, payRef: null })
                .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                .execute();
            throw e;
        }
        try {
            await this.redeemCoupon(ctx, order);
        }
        catch (e) {
            // 扣款成功后券核销失败不能回滚收款，记 error 供对账人工处理
            core_1.Logger.error(`BillPayOrder ${(_b = order.code) !== null && _b !== void 0 ? _b : order.id} paid via balance but coupon ${(_c = order.couponCode) !== null && _c !== void 0 ? _c : '-'} redemption failed: ${String((_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : '')}`, constants_1.loggerCtx);
        }
        const fresh = await repo.findOne({ where: { id: order.id } });
        return fresh;
    }
    /**
     * 支付成功 → 核销券（幂等：仅 UNUSED/RETURNED 可置 USED），并补写券核销流水。
     * 券已被他单使用/查不到属数据异常，支付已不可逆，故只记 error 不抛错。
     */
    async redeemCoupon(orderCtx, order) {
        var _a, _b;
        if (!order.couponCode)
            return;
        const ref = (_a = order.code) !== null && _a !== void 0 ? _a : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`;
        const repo = this.connection.getRepository(orderCtx, coupon_plugin_1.CustomerCoupon);
        const cc = await repo.findOne({ where: { code: order.couponCode } });
        if (!cc) {
            core_1.Logger.error(`BillPayOrder ${ref} paid but coupon ${order.couponCode} not found`, constants_1.loggerCtx);
            return;
        }
        const now = new Date();
        const claim = await repo
            .createQueryBuilder()
            .update(coupon_plugin_1.CustomerCoupon)
            .set({
            status: 'USED',
            usedAt: now,
            usedOrderId: ref,
            reservedOrderId: null,
        })
            .where("id = :id AND status IN ('UNUSED', 'RETURNED')", { id: cc.id })
            .execute();
        if (((_b = claim.affected) !== null && _b !== void 0 ? _b : 0) === 0) {
            core_1.Logger.error(`BillPayOrder ${ref} paid but coupon ${order.couponCode} is ${cc.status}, not redeemed`, constants_1.loggerCtx);
            return;
        }
        await this.recordCouponRedemption(order, cc, now);
        core_1.Logger.info(`BillPayOrder ${ref} paid, coupon ${order.couponCode} marked as USED`, constants_1.loggerCtx);
    }
    /**
     * 写券核销流水（coupon_redemption），供门店/平台对账口径统一。
     * - 买单无门店维度：storeId 记 0（0 即「非门店核销」，可按 0 区分统计）；
     * - merchantId 取订单商户快照，核销金额取本单券抵扣额（分）；
     * - 用 rawConnection 的独立仓库写入，避免流水写失败把已到账的支付事务拖入回滚；
     * - 按「每次核销」落流水，不按券查重：退款将券回退为 RETURNED 后可再次核销，
     *   同券多次核销需各记一条；幂等由 redeemCoupon 的 USED 原子置位（每次支付仅一次核销）保证。
     */
    async recordCouponRedemption(order, cc, redeemedAt) {
        var _a, _b;
        try {
            const repo = this.connection.rawConnection.getRepository(coupon_plugin_1.CouponRedemption);
            await repo.save(new coupon_plugin_1.CouponRedemption({
                customerCouponId: Number(cc.id),
                couponCode: cc.code,
                templateId: Number(cc.templateId),
                saleOrderId: cc.saleOrderId != null ? Number(cc.saleOrderId) : null,
                merchantId: order.merchantId != null ? Number(order.merchantId) : null,
                storeId: 0,
                channelId: Number(order.channelId),
                redeemMode: 'BILLPAY',
                operatorId: null,
                operatorName: null,
                redeemedAt,
                revokedAt: null,
                revokeReason: null,
                amount: order.couponDiscount != null ? Number(order.couponDiscount) : null,
                storeSnapshot: null,
                deviceInfo: null,
            }));
        }
        catch (e) {
            core_1.Logger.error(`BillPayOrder ${(_a = order.code) !== null && _a !== void 0 ? _a : order.id} coupon ${order.couponCode} redemption record failed: ` +
                String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : ''), constants_1.loggerCtx);
        }
    }
    /**
     * 取消/报价过期 → 释放本单预占的券。
     * 只回退「仍是 UNUSED/RETURNED 且 reservedOrderId=本单」的券：已核销（含门店扫码）、
     * 已过期/作废的券一律不动，避免把已消耗的券复活成 UNUSED 造成二次核销；
     * 回退前的 RETURNED（退款回退）保持 RETURNED，不降级成 UNUSED（统计口径一致）。
     */
    async releaseCoupon(ctx, order) {
        var _a;
        if (!order.couponCode)
            return;
        const ref = (_a = order.code) !== null && _a !== void 0 ? _a : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`;
        await this.connection
            .getRepository(ctx, coupon_plugin_1.CustomerCoupon)
            .createQueryBuilder()
            .update(coupon_plugin_1.CustomerCoupon)
            .set({
            status: () => "CASE WHEN status = 'RETURNED' THEN 'RETURNED' ELSE 'UNUSED' END",
            reservedOrderId: null,
            usedOrderId: null,
            usedAt: null,
        })
            .where("code = :code AND reservedOrderId = :ref AND status IN ('UNUSED', 'RETURNED')", {
            code: order.couponCode,
            ref,
        })
            .execute();
    }
    // ===== 管家工作台（admin-api）=====
    /** 人工改价：PENDING_QUOTE → QUOTED，note 必填 */
    async updateBillPayQuote(ctx, id, quoteAmount, note) {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'PENDING_QUOTE') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, quote not allowed`);
        }
        const amount = Math.round(Number(quoteAmount));
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new core_1.UserInputError('Invalid quoteAmount');
        }
        if (!String(note !== null && note !== void 0 ? note : '').trim()) {
            throw new core_1.UserInputError('quote note is required for manual quote');
        }
        const config = await this.getChannelConfig(ctx);
        order.quoteAmount = amount;
        order.discountDetail = JSON.stringify([]);
        order.quoteNote = note;
        this.applyQuoteFields(order, amount, [], config.quoteExpireMinutes);
        order.status = 'QUOTED';
        return this.orderRepo(ctx).save(order);
    }
    /** 接单：PAID → IN_SERVICE，记录操作人；此后取消/退款仅人工入口 */
    async acceptBillPayOrder(ctx, id) {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'PAID') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, accept not allowed`);
        }
        order.status = 'IN_SERVICE';
        order.operatorId = ctx.activeUserId;
        return this.orderRepo(ctx).save(order);
    }
    /** 凭证回传：IN_SERVICE → COMPLETED；超容忍阈值（|actual-quote|/quote > tolerancePercent）需备注 */
    async completeBillPayOrder(ctx, id, actualAmount, proofUrl, note) {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'IN_SERVICE') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, complete not allowed`);
        }
        const amount = Math.round(Number(actualAmount));
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new core_1.UserInputError('Invalid actualAmount');
        }
        if (!String(proofUrl !== null && proofUrl !== void 0 ? proofUrl : '').trim()) {
            throw new core_1.UserInputError('proofUrl is required');
        }
        const config = await this.getChannelConfig(ctx);
        if (order.quoteAmount != null && order.quoteAmount > 0) {
            const deviation = Math.abs(amount - order.quoteAmount) / order.quoteAmount;
            const hasNote = Boolean(String(note !== null && note !== void 0 ? note : '').trim());
            if (deviation * 100 > config.tolerancePercent && !hasNote) {
                throw new core_1.UserInputError('Deviation exceeds tolerance, note is required');
            }
        }
        order.actualAmount = amount;
        order.proofUrl = proofUrl;
        order.completeNote = note !== null && note !== void 0 ? note : null;
        order.status = 'COMPLETED';
        order.completedAt = new Date();
        return this.orderRepo(ctx).save(order);
    }
    /** 结算：COMPLETED → SETTLED，写 bill_pay_settlement 台账（差价模型毛利） */
    async settleBillPayOrder(ctx, id) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'COMPLETED') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, settle not allowed`);
        }
        if (order.actualAmount == null) {
            throw new core_1.UserInputError('actualAmount missing');
        }
        const agreementRepo = this.connection.getRepository(ctx, merchant_agreement_entity_1.MerchantAgreement);
        // 优先按商户 id 命中协议（改名的商户仍可正确结算），无关联时回退按名称
        let agreement = order.merchantId != null
            ? await agreementRepo.findOne({
                where: { channelId: ctx.channelId, merchantId: order.merchantId },
            })
            : null;
        if (!agreement) {
            agreement = await agreementRepo.findOne({
                where: { channelId: ctx.channelId, merchantName: order.merchantName },
            });
        }
        const settleRate = (_a = agreement === null || agreement === void 0 ? void 0 : agreement.settleRate) !== null && _a !== void 0 ? _a : 100;
        // 券成本承担：按订单券码回查模板配置（券码缺失/模板已删时回退平台承担，保持历史口径）
        const couponAmount = order.couponCode
            ? Math.max(0, Math.round(Number((_b = order.couponDiscount) !== null && _b !== void 0 ? _b : 0)))
            : 0;
        let couponBearer = 'PLATFORM';
        let merchantCostRate = 0;
        if (couponAmount > 0 && order.couponCode) {
            const cc = await this.connection
                .getRepository(ctx, coupon_plugin_1.CustomerCoupon)
                .findOne({ where: { code: order.couponCode }, relations: { template: true } });
            couponBearer = (_d = (_c = cc === null || cc === void 0 ? void 0 : cc.template) === null || _c === void 0 ? void 0 : _c.costBearer) !== null && _d !== void 0 ? _d : 'PLATFORM';
            merchantCostRate = Number((_f = (_e = cc === null || cc === void 0 ? void 0 : cc.template) === null || _e === void 0 ? void 0 : _e.merchantCostRate) !== null && _f !== void 0 ? _f : 0);
        }
        const calc = (0, bill_pay_settlement_calc_1.computeSettlementCost)({
            quoteAmount: (_g = order.quoteAmount) !== null && _g !== void 0 ? _g : 0,
            actualAmount: order.actualAmount,
            settleRate,
            couponAmount,
            couponBearer,
            merchantCostRate,
        });
        const settlementRepo = this.connection.getRepository(ctx, bill_pay_settlement_entity_1.BillPaySettlement);
        const existing = await settlementRepo.findOne({ where: { billPayOrderId: order.id } });
        if (existing) {
            order.settleLedgerId = existing.id;
            return this.orderRepo(ctx).save(order);
        }
        const settlement = await settlementRepo.save(new bill_pay_settlement_entity_1.BillPaySettlement({
            billPayOrderId: order.id,
            code: (_h = order.code) !== null && _h !== void 0 ? _h : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`,
            channelId: ctx.channelId,
            merchantName: order.merchantName,
            merchantId: (_k = (_j = order.merchantId) !== null && _j !== void 0 ? _j : agreement === null || agreement === void 0 ? void 0 : agreement.merchantId) !== null && _k !== void 0 ? _k : null,
            quoteAmount: (_l = order.quoteAmount) !== null && _l !== void 0 ? _l : 0,
            actualAmount: order.actualAmount,
            settleRate: calc.settleRate,
            costAmount: calc.costAmount,
            grossAmount: calc.grossAmount,
            couponAmount: calc.couponAmount,
            couponBearer: calc.couponBearer,
            couponCostRate: calc.couponCostRate,
            merchantCouponCost: calc.merchantCouponCost,
            platformCouponCost: calc.platformCouponCost,
            occurredAt: new Date(),
        }));
        order.status = 'SETTLED';
        order.settledAt = new Date();
        order.settleLedgerId = settlement.id;
        return this.orderRepo(ctx).save(order);
    }
    /** 人工退款：仅 PAID 未接单；微信原路退 / 余额退回（IN_SERVICE 后仅走对账人工处理） */
    async refundBillPayOrder(ctx, id, reason) {
        var _a, _b, _c, _d, _e, _f, _g;
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'PAID') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, refund not allowed`);
        }
        if (order.quoteAmount == null) {
            throw new core_1.UserInputError('quoteAmount missing');
        }
        const repo = this.orderRepo(ctx);
        // 单据已确认 REFUNDED 才退券：余额分支后续补款失败、或退款流程异常时，券也不能被永久锁死
        let couponReturnPending = false;
        try {
            if (order.paymentMethod === 'balance') {
                const port = (0, bill_pay_balance_port_1.getBillPayBalancePort)();
                if (!port) {
                    throw new core_1.UserInputError('Balance refund is not available');
                }
                const claim = await repo
                    .createQueryBuilder()
                    .update(bill_pay_order_entity_1.BillPayOrder)
                    .set({ status: 'REFUNDED', refundedAt: new Date() })
                    .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                    .execute();
                if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
                    throw new core_1.UserInputError('Bill pay order is not refundable now');
                }
                couponReturnPending = true;
                await port.addBalance(ctx, order.customerId, order.quoteAmount);
            }
            else {
                if (!gatewayService) {
                    throw new core_1.UserInputError('Payment gateway not configured');
                }
                const outTradeNo = (_c = (_b = order.payRef) !== null && _b !== void 0 ? _b : order.code) !== null && _c !== void 0 ? _c : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`;
                await gatewayService.refundBarePayment(ctx, {
                    outTradeNo,
                    // out_refund_no 同样限制 6~64 位，数字段补零到 6 位避免 BPR-30 类短号被拒
                    outRefundNo: `BPR-${String(order.id).padStart(6, '0')}`,
                    refund: order.quoteAmount,
                    total: order.quoteAmount,
                    reason: reason !== null && reason !== void 0 ? reason : undefined,
                });
                // 微信分支：状态认领成功才算退款落账；失败时单据可能仍是 PAID，不能提前退券
                const claim = await repo
                    .createQueryBuilder()
                    .update(bill_pay_order_entity_1.BillPayOrder)
                    .set({ status: 'REFUNDED', refundedAt: new Date() })
                    .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                    .execute();
                if (((_d = claim.affected) !== null && _d !== void 0 ? _d : 0) === 0) {
                    throw new core_1.UserInputError('Bill pay order is not refundable now');
                }
                couponReturnPending = true;
            }
        }
        finally {
            // 退款已落账即不可逆，券回退失败只记 error（幂等，可人工重试）
            if (couponReturnPending) {
                try {
                    await this.returnCouponOnRefund(ctx, order);
                }
                catch (e) {
                    core_1.Logger.error(`BillPayOrder ${(_e = order.code) !== null && _e !== void 0 ? _e : order.id} refunded but coupon ${(_f = order.couponCode) !== null && _f !== void 0 ? _f : '-'} return failed: ` +
                        String((_g = e === null || e === void 0 ? void 0 : e.message) !== null && _g !== void 0 ? _g : ''), constants_1.loggerCtx);
                }
            }
        }
        return (await repo.findOne({ where: { id: order.id } }));
    }
    /**
     * 退款退券：本单已核销的券 USED → RETURNED，清 usedOrderId/usedAt（券恢复可用直至过期）。
     * 条件带 usedOrderId=本单，防止误退已被其它单核销的券，且天然幂等；
     * 同时对本单写入的 BILLPAY 核销流水做冲销（revokedAt/revokeReason），到店 QR 流水不受影响。
     * 另释放「支付时核销失败」残留的本单预占：这类券仍是 UNUSED/RETURNED + reservedOrderId=本单，
     * 若不清理会被永久锁死（扫码与再下单都被拒）。
     */
    async returnCouponOnRefund(ctx, order) {
        var _a, _b;
        if (!order.couponCode)
            return;
        const ref = (_a = order.code) !== null && _a !== void 0 ? _a : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`;
        const returned = await this.connection
            .getRepository(ctx, coupon_plugin_1.CustomerCoupon)
            .createQueryBuilder()
            .update(coupon_plugin_1.CustomerCoupon)
            .set({ status: 'RETURNED', usedOrderId: null, usedAt: null })
            .where('code = :code AND status = :status AND usedOrderId = :ref', {
            code: order.couponCode,
            status: 'USED',
            ref,
        })
            .execute();
        if (((_b = returned.affected) !== null && _b !== void 0 ? _b : 0) > 0) {
            // 台账冲销：券已被本单核销时，冲销其最近一条未撤销的 BILLPAY 流水（即本单这次核销）
            await this.connection
                .getRepository(ctx, coupon_plugin_1.CouponRedemption)
                .createQueryBuilder()
                .update(coupon_plugin_1.CouponRedemption)
                .set({ revokedAt: new Date(), revokeReason: `订单退款 ${ref}` })
                .where(`id = (SELECT id FROM coupon_redemption WHERE "couponCode" = :code AND "redeemMode" = 'BILLPAY' AND "revokedAt" IS NULL ORDER BY "redeemedAt" DESC LIMIT 1)`, { code: order.couponCode })
                .execute();
        }
        // 残留预占清理（UNUSED 保持 UNUSED、RETURNED 保持 RETURNED，只清本单预占）
        await this.releaseCoupon(ctx, order);
        core_1.Logger.info(`BillPayOrder ${ref} refunded, coupon ${order.couponCode} returned`, constants_1.loggerCtx);
    }
    /** 工作台列表：状态 tab；渠道隔离（超管渠道 1 看全量，对齐 merchantSettlementAdminResolver 口径） */
    async adminList(ctx, opts) {
        var _a, _b;
        const skip = Math.max(0, (_a = opts.skip) !== null && _a !== void 0 ? _a : 0);
        const take = Math.min(100, Math.max(1, (_b = opts.take) !== null && _b !== void 0 ? _b : 20));
        const qb = this.orderRepo(ctx).createQueryBuilder('o');
        if (Number(ctx.channelId) !== 1) {
            qb.andWhere('o.channelId = :channelId', { channelId: ctx.channelId });
        }
        if (opts.status && SETTABLE_STATUSES.includes(opts.status)) {
            qb.andWhere('o.status = :status', { status: opts.status });
        }
        qb.orderBy('o.id', 'DESC').skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async adminFind(ctx, id) {
        return this.loadChannelOrder(ctx, id);
    }
    // ===== 商家协议 =====
    async listAgreements(ctx) {
        const qb = this.connection
            .getRepository(ctx, merchant_agreement_entity_1.MerchantAgreement)
            .createQueryBuilder('a');
        if (Number(ctx.channelId) !== 1) {
            qb.andWhere('a.channelId = :channelId', { channelId: ctx.channelId });
        }
        return qb.orderBy('a.id', 'DESC').getMany();
    }
    /** 商家协议 upsert：渠道内按商家名唯一；能解析到商户时同时落 merchantId */
    async saveAgreement(ctx, input, id) {
        var _a, _b, _c, _d, _e, _f;
        const repo = this.connection.getRepository(ctx, merchant_agreement_entity_1.MerchantAgreement);
        const merchantName = String((_a = input.merchantName) !== null && _a !== void 0 ? _a : '').trim();
        const settleRate = Math.round(Number(input.settleRate));
        if (!merchantName) {
            throw new core_1.UserInputError('merchantName is required');
        }
        if (!Number.isFinite(settleRate) || settleRate <= 0 || settleRate > 100) {
            throw new core_1.UserInputError('settleRate must be 1-100');
        }
        // 协议允许先于商户主数据维护（历史按名称建协议），解析失败不阻断
        const merchant = await this.resolveMerchant(ctx, input.merchantId, merchantName, false);
        const merchantId = (_b = merchant === null || merchant === void 0 ? void 0 : merchant.id) !== null && _b !== void 0 ? _b : null;
        const settleMode = input.settleMode === 'MONTHLY' ? 'MONTHLY' : 'PER_ORDER';
        if (id) {
            const existing = await repo.findOne({ where: { id: id } });
            if (!existing) {
                throw new core_1.UserInputError('Merchant agreement not found');
            }
            existing.merchantName = merchantName;
            existing.merchantId = merchantId;
            existing.settleRate = settleRate;
            existing.settleMode = settleMode;
            existing.contact = (_c = input.contact) !== null && _c !== void 0 ? _c : null;
            existing.note = (_d = input.note) !== null && _d !== void 0 ? _d : null;
            return repo.save(existing);
        }
        const dup = await repo.findOne({
            where: { channelId: ctx.channelId, merchantName },
        });
        if (dup) {
            throw new core_1.UserInputError('Merchant agreement already exists for this channel');
        }
        return repo.save(new merchant_agreement_entity_1.MerchantAgreement({
            channelId: ctx.channelId,
            merchantName,
            merchantId,
            settleRate,
            settleMode: settleMode,
            contact: (_e = input.contact) !== null && _e !== void 0 ? _e : null,
            note: (_f = input.note) !== null && _f !== void 0 ? _f : null,
        }));
    }
    /**
     * 商户租户归属校验：商户至少有一家未删除门店被当前渠道 ACTIVE 认领。
     * merchant-plugin 未装载（无 merchant_store_channel 表）时跳过，退回纯名称模式。
     */
    async assertMerchantClaimed(ctx, merchantId) {
        const qr = this.connection.rawConnection.createQueryRunner();
        const isPostgres = this.connection.rawConnection.options.type === 'postgres';
        try {
            if (!(await qr.hasTable('merchant_store_channel'))) {
                return;
            }
            const rows = await qr.query(`SELECT 1 FROM merchant_store_channel c
                 JOIN merchant_store s ON s.id = c."storeId"
                 WHERE s."merchantId" = ${isPostgres ? '$1' : '?'}
                   AND c."channelId" = ${isPostgres ? '$2' : '?'}
                   AND c.status = 'ACTIVE' AND s."deletedAt" IS NULL
                 LIMIT 1`, [merchantId, Number(ctx.channelId)]);
            if (!Array.isArray(rows) || rows.length === 0) {
                throw new core_1.UserInputError('商家不属于当前租户，无法使用买单券');
            }
        }
        finally {
            await qr.release();
        }
    }
    /**
     * 解析商户关联：优先 merchantId，缺省按名称/编码精确匹配未删除商户。
     * - merchant 表不存在（未装载 merchant-plugin）→ 返回 null，调用方退回纯名称模式；
     * - merchantId 显式传入但不存在/已删除 → 直接报错；
     * - required=false 时名称解析不到返回 null（协议允许先建后补主数据）。
     */
    async resolveMerchant(ctx, merchantId, merchantName, required = true) {
        const qr = this.connection.rawConnection.createQueryRunner();
        const isPostgres = this.connection.rawConnection.options.type === 'postgres';
        const ph = isPostgres ? '$1' : '?';
        try {
            if (!(await qr.hasTable('merchant'))) {
                return null;
            }
            if (merchantId != null) {
                const rows = await qr.query(`SELECT id, name, "deletedAt" FROM merchant WHERE id = ${ph} LIMIT 1`, [Number(merchantId)]);
                if (!Array.isArray(rows) || rows.length === 0) {
                    throw new core_1.UserInputError('商家不存在');
                }
                if (rows[0].deletedAt != null) {
                    throw new core_1.UserInputError('商家已删除');
                }
                return { id: Number(rows[0].id), name: displayName(rows[0].name) };
            }
            const key = String(merchantName !== null && merchantName !== void 0 ? merchantName : '').trim();
            if (!key) {
                return null;
            }
            const rows = await qr.query(`SELECT id, name, "deletedAt" FROM merchant
                 WHERE "deletedAt" IS NULL AND (code = ${ph} OR name = ${ph})
                 ORDER BY id LIMIT 1`, [key]);
            if (Array.isArray(rows) && rows.length > 0) {
                return { id: Number(rows[0].id), name: displayName(rows[0].name) };
            }
            if (required) {
                throw new core_1.UserInputError('商家不存在，请从商家列表选择');
            }
            return null;
        }
        finally {
            await qr.release();
        }
    }
    // ===== 渠道配置（admin）=====
    async getRawChannelConfig(ctx) {
        return this.getChannelConfig(ctx);
    }
    async saveChannelConfig(ctx, config) {
        const parsed = (0, quote_engine_1.parseBillPayConfig)(config);
        const repo = this.connection.getRepository(ctx, bill_pay_config_entity_1.BillPayChannelConfigEntity);
        const row = await repo.findOne({ where: { channelId: ctx.channelId } });
        if (row) {
            row.config = JSON.stringify(parsed);
            await repo.save(row);
        }
        else {
            await repo.save(new bill_pay_config_entity_1.BillPayChannelConfigEntity({
                channelId: ctx.channelId,
                config: JSON.stringify(parsed),
            }));
        }
        return parsed;
    }
};
exports.BillPayService = BillPayService;
exports.BillPayService = BillPayService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService,
        core_1.ChannelService])
], BillPayService);
/** 商户名可能以 LocalizedText（JSON）落库，取中文/首个可用值作为订单快照名 */
function displayName(raw) {
    var _a, _b, _c;
    if (typeof raw !== 'string') {
        return raw == null ? '' : String(raw);
    }
    const text = raw.trim();
    if (!text.startsWith('{')) {
        return text;
    }
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
            return String((_c = (_b = (_a = parsed['zh-Hans']) !== null && _a !== void 0 ? _a : parsed['zh']) !== null && _b !== void 0 ? _b : parsed[Object.keys(parsed)[0]]) !== null && _c !== void 0 ? _c : '');
        }
    }
    catch (_d) {
        // 非合法 JSON：按原文返回
    }
    return text;
}
//# sourceMappingURL=bill-pay.service.js.map