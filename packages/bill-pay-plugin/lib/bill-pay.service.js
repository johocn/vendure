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
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
const bill_pay_balance_port_1 = require("./bill-pay-balance-port");
const bill_pay_config_entity_1 = require("./bill-pay-config.entity");
const bill_pay_order_entity_1 = require("./bill-pay-order.entity");
const bill_pay_settlement_entity_1 = require("./bill-pay-settlement.entity");
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
        var _a;
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
    /** 客户提交委托：限额校验（单笔 min + 单日累计）→ PENDING_QUOTE，autoQuote 命中即同步报价转 QUOTED */
    async createBillPayOrder(ctx, input) {
        var _a, _b, _c, _d;
        const customerId = await this.currentCustomerId(ctx);
        const merchantName = String((_a = input.merchantName) !== null && _a !== void 0 ? _a : '').trim();
        if (!merchantName) {
            throw new core_1.UserInputError('merchantName is required');
        }
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
        const repo = this.orderRepo(ctx);
        let order = await repo.save(new bill_pay_order_entity_1.BillPayOrder({
            code: null,
            customerId,
            merchantName,
            expectedAmount,
            quoteAmount: null,
            actualAmount: null,
            discountDetail: null,
            status: 'PENDING_QUOTE',
            remark: (_c = input.remark) !== null && _c !== void 0 ? _c : null,
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
        core_1.Logger.info(`BillPayOrder ${order.code} created (status=${order.status}, quote=${(_d = order.quoteAmount) !== null && _d !== void 0 ? _d : '-'})`, constants_1.loggerCtx);
        return order;
    }
    /** 客户自助取消：仅 PENDING_QUOTE / QUOTED */
    async cancelBillPayOrder(ctx, id) {
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'PENDING_QUOTE' && order.status !== 'QUOTED') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, cannot cancel`);
        }
        order.status = 'CANCELLED';
        return this.orderRepo(ctx).save(order);
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
        var _a;
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
    /** 余额支付（同步结算）：先置 PAID 再扣余额（扣款内部提交事务，顺序对齐 coupon-sale L152-170） */
    async payBillPayOrderWithBalance(ctx, id) {
        var _a;
        const port = (0, bill_pay_balance_port_1.getBillPayBalancePort)();
        if (!port) {
            throw new core_1.UserInputError('Balance payment is not available');
        }
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'QUOTED' || order.quoteAmount == null) {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, not payable`);
        }
        order.paymentMethod = 'balance';
        order.payRef = order.code;
        order.status = 'PAID';
        order.paidAt = (_a = order.paidAt) !== null && _a !== void 0 ? _a : new Date();
        await this.orderRepo(ctx).save(order);
        await port.deductBalance(ctx, order.customerId, order.quoteAmount);
        const fresh = await this.orderRepo(ctx).findOne({ where: { id: order.id } });
        return fresh;
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
        var _a, _b, _c, _d;
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'COMPLETED') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, settle not allowed`);
        }
        if (order.actualAmount == null) {
            throw new core_1.UserInputError('actualAmount missing');
        }
        const agreementRepo = this.connection.getRepository(ctx, merchant_agreement_entity_1.MerchantAgreement);
        const agreement = await agreementRepo.findOne({
            where: { channelId: ctx.channelId, merchantName: order.merchantName },
        });
        const settleRate = (_a = agreement === null || agreement === void 0 ? void 0 : agreement.settleRate) !== null && _a !== void 0 ? _a : 100;
        const costAmount = Math.round((order.actualAmount * settleRate) / 100);
        const settlementRepo = this.connection.getRepository(ctx, bill_pay_settlement_entity_1.BillPaySettlement);
        const existing = await settlementRepo.findOne({ where: { billPayOrderId: order.id } });
        if (existing) {
            order.settleLedgerId = existing.id;
            return this.orderRepo(ctx).save(order);
        }
        const settlement = await settlementRepo.save(new bill_pay_settlement_entity_1.BillPaySettlement({
            billPayOrderId: order.id,
            code: (_b = order.code) !== null && _b !== void 0 ? _b : `${constants_1.BILLPAY_CODE_PREFIX}${order.id}`,
            channelId: ctx.channelId,
            merchantName: order.merchantName,
            quoteAmount: (_c = order.quoteAmount) !== null && _c !== void 0 ? _c : 0,
            actualAmount: order.actualAmount,
            settleRate,
            costAmount,
            grossAmount: ((_d = order.quoteAmount) !== null && _d !== void 0 ? _d : 0) - costAmount,
            occurredAt: new Date(),
        }));
        order.status = 'SETTLED';
        order.settledAt = new Date();
        order.settleLedgerId = settlement.id;
        return this.orderRepo(ctx).save(order);
    }
    /** 人工退款：仅 PAID 未接单；微信原路退 / 余额退回（IN_SERVICE 后仅走对账人工处理） */
    async refundBillPayOrder(ctx, id, reason) {
        var _a, _b, _c, _d;
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'PAID') {
            throw new core_1.UserInputError(`Bill pay order is ${order.status}, refund not allowed`);
        }
        if (order.quoteAmount == null) {
            throw new core_1.UserInputError('quoteAmount missing');
        }
        const repo = this.orderRepo(ctx);
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
            const claim = await repo
                .createQueryBuilder()
                .update(bill_pay_order_entity_1.BillPayOrder)
                .set({ status: 'REFUNDED', refundedAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                .execute();
            if (((_d = claim.affected) !== null && _d !== void 0 ? _d : 0) === 0) {
                throw new core_1.UserInputError('Bill pay order is not refundable now');
            }
        }
        return (await repo.findOne({ where: { id: order.id } }));
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
    /** 商家协议 upsert：渠道内按商家名唯一 */
    async saveAgreement(ctx, input, id) {
        var _a, _b, _c, _d, _e;
        const repo = this.connection.getRepository(ctx, merchant_agreement_entity_1.MerchantAgreement);
        const merchantName = String((_a = input.merchantName) !== null && _a !== void 0 ? _a : '').trim();
        const settleRate = Math.round(Number(input.settleRate));
        if (!merchantName) {
            throw new core_1.UserInputError('merchantName is required');
        }
        if (!Number.isFinite(settleRate) || settleRate <= 0 || settleRate > 100) {
            throw new core_1.UserInputError('settleRate must be 1-100');
        }
        const settleMode = input.settleMode === 'MONTHLY' ? 'MONTHLY' : 'PER_ORDER';
        if (id) {
            const existing = await repo.findOne({ where: { id: id } });
            if (!existing) {
                throw new core_1.UserInputError('Merchant agreement not found');
            }
            existing.merchantName = merchantName;
            existing.settleRate = settleRate;
            existing.settleMode = settleMode;
            existing.contact = (_b = input.contact) !== null && _b !== void 0 ? _b : null;
            existing.note = (_c = input.note) !== null && _c !== void 0 ? _c : null;
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
            settleRate,
            settleMode: settleMode,
            contact: (_d = input.contact) !== null && _d !== void 0 ? _d : null,
            note: (_e = input.note) !== null && _e !== void 0 ? _e : null,
        }));
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
//# sourceMappingURL=bill-pay.service.js.map