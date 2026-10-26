import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    CustomerService,
    ID,
    Logger,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import {
    computeInStoreBill,
    CouponTemplate,
    CustomerCoupon,
    IN_STORE_REASON_MESSAGES,
} from '@vendure/coupon-plugin';
import { WechatpayService, resolveCustomerOpenid } from '@vendure/wechatpay-plugin';

import { getBillPayBalancePort } from './bill-pay-balance-port';
import { BillPayChannelConfigEntity } from './bill-pay-config.entity';
import { applyCouponToQuote } from './bill-pay-coupon';
import { BillPayOrder } from './bill-pay-order.entity';
import { BillPaySettlement } from './bill-pay-settlement.entity';
import { MerchantAgreement } from './merchant-agreement.entity';
import { BILLPAY_CODE_PREFIX, loggerCtx } from './constants';
import { parseBillPayConfig, quoteBill } from './quote-engine';
import {
    BillPayChannelConfig,
    BillPayStatus,
    DEFAULT_BILLPAY_CONFIG,
    isQuoteRejected,
    QuoteDiscountItem,
    QuoteResult,
} from './types';

/**
 * 进程内网关引用（镜像 coupon-sale.service.ts 的 setCouponSaleGateway 模式）：
 * 由 plugin.ts 启动时经 Injector 取到 WechatpayService 后注入；未装载 WechatpayPlugin 时为 null。
 */
let gatewayService: WechatpayService | null = null;
export function setBillPayGateway(gw: WechatpayService | null): void {
    gatewayService = gw;
}

const SETTABLE_STATUSES: BillPayStatus[] = [
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
@Injectable()
export class BillPayService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private channelService: ChannelService,
    ) {}

    // ===== 基础 =====

    private async currentCustomerId(ctx: RequestContext): Promise<number> {
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId!);
        if (!customer) {
            throw new UserInputError('No customer for the current user');
        }
        return customer.id as number;
    }

    /** 渠道配置：bill_pay_config JSON → 解析（坏配置逐字段回退默认） */
    async getChannelConfig(ctx: RequestContext): Promise<BillPayChannelConfig> {
        const repo = this.connection.getRepository(ctx, BillPayChannelConfigEntity);
        const row = await repo.findOne({ where: { channelId: ctx.channelId as any } });
        if (!row) {
            return { ...DEFAULT_BILLPAY_CONFIG };
        }
        return parseBillPayConfig(row.config);
    }

    /** 实体 → GraphQL 形态（discountDetail JSON 反序列化） */
    toGraph(order: BillPayOrder): any {
        let discountDetail: QuoteDiscountItem[] | string | null = null;
        if (order.discountDetail) {
            try {
                const parsed = JSON.parse(order.discountDetail);
                discountDetail = Array.isArray(parsed) ? parsed : order.discountDetail;
            } catch {
                discountDetail = order.discountDetail;
            }
        }
        return { ...order, discountDetail };
    }

    private orderRepo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, BillPayOrder);
    }

    /** 惰性报价过期：QUOTED 超期 → 回 PENDING_QUOTE（读路径收敛，不依赖定时器） */
    private async normalizeQuoteExpiry(ctx: RequestContext, order: BillPayOrder): Promise<BillPayOrder> {
        if (
            order.status === 'QUOTED' &&
            order.quoteExpireAt &&
            order.quoteExpireAt.getTime() < Date.now()
        ) {
            const claim = await this.orderRepo(ctx)
                .createQueryBuilder()
                .update(BillPayOrder)
                .set({ status: 'PENDING_QUOTE' })
                .where('id = :id AND status = :status', { id: order.id, status: 'QUOTED' })
                .execute();
            if ((claim.affected ?? 0) > 0) {
                order.status = 'PENDING_QUOTE';
                if (order.couponCode) {
                    // 报价过期会回退人工报价，而人工改价会重写金额与明细、无法保留券抵扣；
                    // 此时释放券并清空券字段，避免「有券码无抵扣」的脏单把券永久锁死。
                    try {
                        await this.releaseCoupon(ctx, order);
                    } catch (e: any) {
                        Logger.error(
                            `BillPayOrder ${order.code ?? order.id} quote expired but coupon ` +
                                `${order.couponCode} release failed: ${String(e?.message ?? '')}`,
                            loggerCtx,
                        );
                    }
                    order.couponCode = null;
                    order.couponDiscount = null;
                    await this.orderRepo(ctx).save(order);
                }
            }
        }
        return order;
    }

    private async loadChannelOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        const order = await this.orderRepo(ctx).findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        if (!order) {
            throw new UserInputError('Bill pay order not found');
        }
        return this.normalizeQuoteExpiry(ctx, order);
    }

    private async loadOwnedOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.customerId !== (await this.currentCustomerId(ctx))) {
            throw new UserInputError('Bill pay order does not belong to the current customer');
        }
        return order;
    }

    private applyQuoteFields(
        order: BillPayOrder,
        payable: number,
        discountDetail: QuoteDiscountItem[],
        expireMinutes: number,
    ): void {
        order.quoteAmount = payable;
        order.discountDetail = JSON.stringify(discountDetail);
        order.quoteExpireAt = new Date(Date.now() + expireMinutes * 60_000);
    }

    // ===== 客户侧 =====

    /** 客户提交委托：限额校验（单笔 min + 单日累计）→ PENDING_QUOTE，autoQuote 命中即同步报价转 QUOTED */
    async createBillPayOrder(
        ctx: RequestContext,
        input: {
            merchantName: string;
            expectedAmount: number;
            remark?: string | null;
            couponCode?: string | null;
        },
    ): Promise<BillPayOrder> {
        const customerId = await this.currentCustomerId(ctx);
        const merchantName = String(input.merchantName ?? '').trim();
        if (!merchantName) {
            throw new UserInputError('merchantName is required');
        }
        const expectedAmount = Math.round(Number(input.expectedAmount));
        const config = await this.getChannelConfig(ctx);
        if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
            throw new UserInputError('Invalid expectedAmount');
        }
        if (expectedAmount < config.minAmount) {
            throw new UserInputError(`Amount below minimum (${config.minAmount})`);
        }

        // 单日累计限额（合规 §13）：当日未取消/未退款单的应累计 + 本单预估 ≤ dailyLimitAmount
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const agg = await this.orderRepo(ctx)
            .createQueryBuilder('o')
            .select('COALESCE(SUM(COALESCE(o.quoteAmount, o.expectedAmount)), 0)', 'total')
            .where('o.customerId = :customerId AND o.channelId = :channelId', {
                customerId,
                channelId: ctx.channelId as any,
            })
            .andWhere('o.createdAt >= :start', { start: startOfDay })
            .andWhere('o.status NOT IN (:...excluded)', {
                excluded: ['CANCELLED', 'REFUNDED'],
            })
            .getRawOne();
        const todayTotal = Number(agg?.total ?? 0);
        if (todayTotal + expectedAmount > config.dailyLimitAmount) {
            throw new UserInputError('Daily bill pay limit exceeded');
        }

        const couponCode = input.couponCode?.trim() || null;
        // 用券只能在自动报价路径完成：人工报价会重写 quoteAmount/discountDetail，
        // 已预占的券会落成「有券码无抵扣」的脏单，故券路径直接拒绝转人工场景。
        let couponPlan: {
            cc: CustomerCoupon;
            quote: QuoteResult;
            discount: number;
        } | null = null;
        if (couponCode) {
            if (config.couponEnabled !== true) {
                throw new UserInputError('Coupon not enabled for bill pay');
            }
            const couponOutcome = quoteBill(expectedAmount, config);
            if (isQuoteRejected(couponOutcome) || !config.autoQuote) {
                if (isQuoteRejected(couponOutcome) && couponOutcome.reason === 'BELOW_MIN') {
                    throw new UserInputError(`Amount below minimum (${config.minAmount})`);
                }
                if (isQuoteRejected(couponOutcome) && couponOutcome.reason === 'INVALID_AMOUNT') {
                    throw new UserInputError('Invalid expectedAmount');
                }
                throw new UserInputError('Coupon not supported for manual quote amount');
            }
            const couponRepo = this.connection.getRepository(ctx, CustomerCoupon);
            const cc = await couponRepo.findOne({
                where: { code: couponCode },
                relations: { template: { channels: true } },
            });
            // 统一文案：不区分他人的券/已用/过期，避免券码枚举泄露他人信息
            if (
                !cc ||
                cc.customerId !== customerId ||
                cc.status !== 'UNUSED' ||
                (cc.expiredAt && new Date(cc.expiredAt).getTime() <= Date.now())
            ) {
                throw new UserInputError('Coupon is not applicable to bill pay');
            }
            const tpl = cc.template;
            const scene = tpl?.usageScene ?? 'ONLINE';
            // 券模板是 ChannelAware：必须属于当前渠道，否则跨租户券码可在本店买单抵扣
            const inChannel = (tpl?.channels ?? []).some(
                (ch) => Number(ch.id) === Number(ctx.channelId),
            );
            if (!tpl || !tpl.enabled || !inChannel || (scene !== 'IN_STORE' && scene !== 'ALL')) {
                throw new UserInputError('Coupon is not applicable to bill pay');
            }
            // 门槛按商家账单原价判定，与到店核销口径一致；券只抵「报价后应付」，不叠加到原价上
            const computed = computeInStoreBill(tpl, expectedAmount);
            if (!computed.ok) {
                throw new UserInputError(IN_STORE_REASON_MESSAGES[computed.reason]);
            }
            const quote = applyCouponToQuote(couponOutcome, computed.discountAmount, tpl.name);
            const discount = Math.min(computed.discountAmount, couponOutcome.payable);
            couponPlan = { cc, quote, discount };
        }

        const repo = this.orderRepo(ctx);
        let order = await repo.save(
            new BillPayOrder({
                code: null,
                customerId,
                merchantName,
                expectedAmount,
                quoteAmount: null,
                actualAmount: null,
                discountDetail: null,
                couponCode,
                couponDiscount: couponPlan ? couponPlan.discount : null,
                status: 'PENDING_QUOTE',
                remark: input.remark ?? null,
                quoteNote: null,
                quoteExpireAt: null,
                proofUrl: null,
                payRef: null,
                paymentMethod: null,
                operatorId: null,
                settleLedgerId: null,
                channelId: ctx.channelId as number,
            }),
        );
        if (!order.code) {
            order.code = `${BILLPAY_CODE_PREFIX}${order.id}`;
            order = await repo.save(order);
        }

        if (couponPlan) {
            // 先预占再落报价：并发同码下单时只有一单能占住券，另一单在报价落库前就被截断
            const reserve = await this.connection
                .getRepository(ctx, CustomerCoupon)
                .createQueryBuilder()
                .update(CustomerCoupon)
                .set({ reservedOrderId: order.code ?? `${BILLPAY_CODE_PREFIX}${order.id}` })
                .where('id = :id AND status = :status AND reservedOrderId IS NULL', {
                    id: couponPlan.cc.id,
                    status: 'UNUSED',
                })
                .execute();
            if ((reserve.affected ?? 0) === 0) {
                order.status = 'CANCELLED';
                await repo.save(order);
                throw new UserInputError('Coupon is already in use');
            }
            this.applyQuoteFields(order, couponPlan.quote.payable, couponPlan.quote.discountDetail, config.quoteExpireMinutes);
            order.status = 'QUOTED';
            order = await repo.save(order);
            Logger.info(
                `BillPayOrder ${order.code ?? order.id} created with coupon ` +
                    `${couponPlan.cc.code} (quote=${couponPlan.quote.payable}, couponDiscount=${couponPlan.discount})`,
                loggerCtx,
            );
            return order;
        }

        // 自动报价：金额区间内且 autoQuote → 同步报价转 QUOTED；超 maxAmount 转人工（保持 PENDING_QUOTE）
        const outcome = quoteBill(expectedAmount, config);
        if (config.autoQuote && !isQuoteRejected(outcome)) {
            this.applyQuoteFields(order, outcome.payable, outcome.discountDetail, config.quoteExpireMinutes);
            order.status = 'QUOTED';
            order = await repo.save(order);
        } else if (isQuoteRejected(outcome) && outcome.reason === 'INVALID_AMOUNT') {
            throw new UserInputError('Invalid expectedAmount');
        }
        Logger.info(
            `BillPayOrder ${order.code} created (status=${order.status}, quote=${order.quoteAmount ?? '-'})`,
            loggerCtx,
        );
        return order;
    }

    /** 客户自助取消：仅 PENDING_QUOTE / QUOTED */
    async cancelBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'PENDING_QUOTE' && order.status !== 'QUOTED') {
            throw new UserInputError(`Bill pay order is ${order.status}, cannot cancel`);
        }
        order.status = 'CANCELLED';
        const saved = await this.orderRepo(ctx).save(order);
        try {
            await this.releaseCoupon(ctx, order);
        } catch (e: any) {
            // 取消失败于释放券会把券永久锁死，但不该阻断取消本身，记 error 供人工处理
            Logger.error(
                `BillPayOrder ${saved.code ?? saved.id} cancelled but coupon ${order.couponCode ?? '-'} release failed: ${String(e?.message ?? '')}`,
                loggerCtx,
            );
        }
        return saved;
    }

    /** 我的委托单 */
    async myBillPayOrders(ctx: RequestContext, statuses?: BillPayStatus[]): Promise<BillPayOrder[]> {
        const customerId = await this.currentCustomerId(ctx);
        const qb = this.orderRepo(ctx)
            .createQueryBuilder('o')
            .where('o.customerId = :customerId AND o.channelId = :channelId', {
                customerId,
                channelId: ctx.channelId as any,
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

    async findOwnedBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        return this.loadOwnedOrder(ctx, id);
    }

    // ===== 支付 =====

    /** 生成微信支付参数（仅本人 QUOTED 未超期单），镜像 coupon-sale 的 CS- 范式，单号前缀 BP- */
    async createWechatBillPayment(
        ctx: RequestContext,
        id: ID,
        tradeType?: 'JSAPI' | 'NATIVE' | 'H5' | 'APP',
        openid?: string,
    ): Promise<any> {
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'QUOTED' || order.quoteAmount == null) {
            throw new UserInputError(`Bill pay order is ${order.status}, not payable`);
        }
        if (!gatewayService) {
            throw new UserInputError('Payment gateway not configured');
        }
        const gateway = gatewayService; // 收窄为不可空引用（闭包内使用不再触发 possibly null）
        // 微信要求 out_trade_no 至少 6 位（6~32）：小 id 的 `BP-30` 会被拒为「商户订单号错误」，
        // 故数字段左补零到 6 位；回调解析 /^BP-(\d+)$/ 不受影响。
        const rawRef = order.code ?? `${BILLPAY_CODE_PREFIX}${order.id}`;
        const outTradeNo = rawRef.replace(/^BP-(\d+)$/, (_m, d: string) => `BP-${String(Number(d)).padStart(6, '0')}`);
        const effectiveTradeType = tradeType || 'JSAPI';
        // 渠道配了商户凭证（payConfig override）= 公众号/H5 场景，JSAPI 必须优先公众号 openid，
        // 否则取到小程序 openid 时 appId 不一致（openid 按 appid 隔离），支付必然失败。
        const effectiveOpenid =
            openid ||
            (await resolveCustomerOpenid(ctx, order.customerId, {
                preferMini: effectiveTradeType === 'JSAPI' && !gateway.hasChannelPayConfig(ctx),
            }));
        const pay = await gateway.createBarePayment(
            {
                outTradeNo,
                amount: order.quoteAmount,
                tradeType: effectiveTradeType,
                openid: effectiveOpenid,
                description: `BillPay ${outTradeNo}`,
            },
            ctx,
        );
        order.paymentMethod = 'wechatpay';
        order.payRef = outTradeNo;
        await this.orderRepo(ctx).save(order);
        return { billPayOrderId: order.id, outTradeNo, pay };
    }

    /** 微信回调结算入口：解析 BP-<id>，原子置 QUOTED → PAID（幂等，参照 coupon-sale L208-237） */
    async settleBillPayOrderByOutTradeNo(ctx: RequestContext, outTradeNo: string): Promise<void> {
        const m = String(outTradeNo).match(/^BP-(\d+)$/);
        if (!m) {
            throw new UserInputError('Invalid bill pay out_trade_no');
        }
        // 回调域名解析出的渠道未必是下单渠道（回调落默认渠道域名时），
        // 不能按 ctx.channelId 过滤，否则查不到单→已扣款不结单；先按 id 取单再切到订单自身渠道。
        const order = await this.orderRepo(ctx).findOne({
            where: { id: Number(m[1]) as any },
        });
        if (!order) {
            throw new UserInputError('Bill pay order not found');
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
                .update(BillPayOrder)
                .set({ status: 'PAID', paidAt: new Date(), payRef: outTradeNo })
                .where('id = :id AND status = :status', { id: order.id, status: 'QUOTED' })
                .execute();
            if ((claim.affected ?? 0) === 0) {
                await this.connection.commitOpenTransaction(orderCtx);
                return; // 并发下已被他人结算
            }
            // 与置 PAID 同事务核销券：券异常不阻断已到账的收款，只记日志供对账
            try {
                await this.redeemCoupon(orderCtx, order);
            } catch (e: any) {
                Logger.error(
                    `BillPayOrder ${outTradeNo} paid but coupon ${order.couponCode ?? '-'} redemption failed: ${String(e?.message ?? '')}`,
                    loggerCtx,
                );
            }
            await this.connection.commitOpenTransaction(orderCtx);
        } catch (e) {
            await this.connection.rollBackTransaction(orderCtx);
            throw e;
        }
        Logger.info(`BillPayOrder ${outTradeNo} settled via wechat callback`, loggerCtx);
    }

    /** 账单支付单所属渠道的 admin ctx（回调 ctx 的渠道可能与之不同） */
    private async orderChannelCtx(ctx: RequestContext, channelId: ID): Promise<RequestContext> {
        if (Number(channelId) === Number(ctx.channelId)) return ctx;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel) {
            throw new UserInputError(`Channel ${channelId} of bill pay order not found`);
        }
        return new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }

    /** 余额支付（同步结算）：先置 PAID 再扣余额（扣款内部提交事务，顺序对齐 coupon-sale L152-170） */
    async payBillPayOrderWithBalance(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        const port = getBillPayBalancePort();
        if (!port) {
            throw new UserInputError('Balance payment is not available');
        }
        const order = await this.loadOwnedOrder(ctx, id);
        if (order.status !== 'QUOTED' || order.quoteAmount == null) {
            throw new UserInputError(`Bill pay order is ${order.status}, not payable`);
        }
        order.paymentMethod = 'balance';
        order.payRef = order.code;
        order.status = 'PAID';
        order.paidAt = order.paidAt ?? new Date();
        await this.orderRepo(ctx).save(order);
        await port.deductBalance(ctx, order.customerId, order.quoteAmount);
        try {
            await this.redeemCoupon(ctx, order);
        } catch (e: any) {
            // 扣款成功后券核销失败不能回滚收款，记 error 供对账人工处理
            Logger.error(
                `BillPayOrder ${order.code ?? order.id} paid via balance but coupon ${order.couponCode ?? '-'} redemption failed: ${String(e?.message ?? '')}`,
                loggerCtx,
            );
        }
        const fresh = await this.orderRepo(ctx).findOne({ where: { id: order.id } });
        return fresh as BillPayOrder;
    }

    /**
     * 支付成功 → 核销券（幂等：仅 UNUSED 可置 USED）。
     * 券已被他单使用/查不到属数据异常，支付已不可逆，故只记 error 不抛错。
     */
    private async redeemCoupon(orderCtx: RequestContext, order: BillPayOrder): Promise<void> {
        if (!order.couponCode) return;
        const ref = order.code ?? `${BILLPAY_CODE_PREFIX}${order.id}`;
        const repo = this.connection.getRepository(orderCtx, CustomerCoupon);
        const cc = await repo.findOne({ where: { code: order.couponCode } });
        if (!cc) {
            Logger.error(`BillPayOrder ${ref} paid but coupon ${order.couponCode} not found`, loggerCtx);
            return;
        }
        const claim = await repo
            .createQueryBuilder()
            .update(CustomerCoupon)
            .set({
                status: 'USED',
                usedAt: new Date(),
                usedOrderId: ref,
                reservedOrderId: null as any,
            })
            .where('id = :id AND status = :status', { id: cc.id, status: 'UNUSED' })
            .execute();
        if ((claim.affected ?? 0) === 0) {
            Logger.error(
                `BillPayOrder ${ref} paid but coupon ${order.couponCode} is ${cc.status}, not redeemed`,
                loggerCtx,
            );
            return;
        }
        Logger.info(`BillPayOrder ${ref} paid, coupon ${order.couponCode} marked as USED`, loggerCtx);
    }

    /**
     * 取消 → 释放券：只回退本单预占（reservedOrderId）或本单已核销（usedOrderId）的券，
     * 防止误释放已被其它委托单使用的券。
     */
    private async releaseCoupon(ctx: RequestContext, order: BillPayOrder): Promise<void> {
        if (!order.couponCode) return;
        const ref = order.code ?? `${BILLPAY_CODE_PREFIX}${order.id}`;
        await this.connection
            .getRepository(ctx, CustomerCoupon)
            .createQueryBuilder()
            .update(CustomerCoupon)
            .set({
                status: 'UNUSED',
                reservedOrderId: null as any,
                usedOrderId: null as any,
                usedAt: null as any,
            })
            .where('code = :code AND (reservedOrderId = :ref OR (status = :used AND usedOrderId = :ref))', {
                code: order.couponCode,
                ref,
                used: 'USED',
            })
            .execute();
    }

    // ===== 管家工作台（admin-api）=====

    /** 人工改价：PENDING_QUOTE → QUOTED，note 必填 */
    async updateBillPayQuote(ctx: RequestContext, id: ID, quoteAmount: number, note: string): Promise<BillPayOrder> {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'PENDING_QUOTE') {
            throw new UserInputError(`Bill pay order is ${order.status}, quote not allowed`);
        }
        const amount = Math.round(Number(quoteAmount));
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new UserInputError('Invalid quoteAmount');
        }
        if (!String(note ?? '').trim()) {
            throw new UserInputError('quote note is required for manual quote');
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
    async acceptBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'PAID') {
            throw new UserInputError(`Bill pay order is ${order.status}, accept not allowed`);
        }
        order.status = 'IN_SERVICE';
        order.operatorId = ctx.activeUserId as number;
        return this.orderRepo(ctx).save(order);
    }

    /** 凭证回传：IN_SERVICE → COMPLETED；超容忍阈值（|actual-quote|/quote > tolerancePercent）需备注 */
    async completeBillPayOrder(
        ctx: RequestContext,
        id: ID,
        actualAmount: number,
        proofUrl: string,
        note?: string | null,
    ): Promise<BillPayOrder> {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'IN_SERVICE') {
            throw new UserInputError(`Bill pay order is ${order.status}, complete not allowed`);
        }
        const amount = Math.round(Number(actualAmount));
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new UserInputError('Invalid actualAmount');
        }
        if (!String(proofUrl ?? '').trim()) {
            throw new UserInputError('proofUrl is required');
        }
        const config = await this.getChannelConfig(ctx);
        if (order.quoteAmount != null && order.quoteAmount > 0) {
            const deviation = Math.abs(amount - order.quoteAmount) / order.quoteAmount;
            const hasNote = Boolean(String(note ?? '').trim());
            if (deviation * 100 > config.tolerancePercent && !hasNote) {
                throw new UserInputError('Deviation exceeds tolerance, note is required');
            }
        }
        order.actualAmount = amount;
        order.proofUrl = proofUrl;
        order.completeNote = note ?? null;
        order.status = 'COMPLETED';
        order.completedAt = new Date();
        return this.orderRepo(ctx).save(order);
    }

    /** 结算：COMPLETED → SETTLED，写 bill_pay_settlement 台账（差价模型毛利） */
    async settleBillPayOrder(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'COMPLETED') {
            throw new UserInputError(`Bill pay order is ${order.status}, settle not allowed`);
        }
        if (order.actualAmount == null) {
            throw new UserInputError('actualAmount missing');
        }
        const agreementRepo = this.connection.getRepository(ctx, MerchantAgreement);
        const agreement = await agreementRepo.findOne({
            where: { channelId: ctx.channelId as any, merchantName: order.merchantName },
        });
        const settleRate = agreement?.settleRate ?? 100;
        const costAmount = Math.round((order.actualAmount * settleRate) / 100);
        const settlementRepo = this.connection.getRepository(ctx, BillPaySettlement);
        const existing = await settlementRepo.findOne({ where: { billPayOrderId: order.id as any } });
        if (existing) {
            order.settleLedgerId = existing.id as number;
            return this.orderRepo(ctx).save(order);
        }
        const settlement = await settlementRepo.save(
            new BillPaySettlement({
                billPayOrderId: order.id as number,
                code: order.code ?? `${BILLPAY_CODE_PREFIX}${order.id}`,
                channelId: ctx.channelId as number,
                merchantName: order.merchantName,
                quoteAmount: order.quoteAmount ?? 0,
                actualAmount: order.actualAmount,
                settleRate,
                costAmount,
                grossAmount: (order.quoteAmount ?? 0) - costAmount,
                occurredAt: new Date(),
            }),
        );
        order.status = 'SETTLED';
        order.settledAt = new Date();
        order.settleLedgerId = settlement.id as number;
        return this.orderRepo(ctx).save(order);
    }

    /** 人工退款：仅 PAID 未接单；微信原路退 / 余额退回（IN_SERVICE 后仅走对账人工处理） */
    async refundBillPayOrder(ctx: RequestContext, id: ID, reason?: string): Promise<BillPayOrder> {
        const order = await this.loadChannelOrder(ctx, id);
        if (order.status !== 'PAID') {
            throw new UserInputError(`Bill pay order is ${order.status}, refund not allowed`);
        }
        if (order.quoteAmount == null) {
            throw new UserInputError('quoteAmount missing');
        }
        const repo = this.orderRepo(ctx);
        if (order.paymentMethod === 'balance') {
            const port = getBillPayBalancePort();
            if (!port) {
                throw new UserInputError('Balance refund is not available');
            }
            const claim = await repo
                .createQueryBuilder()
                .update(BillPayOrder)
                .set({ status: 'REFUNDED', refundedAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                .execute();
            if ((claim.affected ?? 0) === 0) {
                throw new UserInputError('Bill pay order is not refundable now');
            }
            await port.addBalance(ctx, order.customerId, order.quoteAmount);
        } else {
            if (!gatewayService) {
                throw new UserInputError('Payment gateway not configured');
            }
            const outTradeNo = order.payRef ?? order.code ?? `${BILLPAY_CODE_PREFIX}${order.id}`;
            await gatewayService.refundBarePayment(ctx, {
                outTradeNo,
                // out_refund_no 同样限制 6~64 位，数字段补零到 6 位避免 BPR-30 类短号被拒
                outRefundNo: `BPR-${String(order.id).padStart(6, '0')}`,
                refund: order.quoteAmount,
                total: order.quoteAmount,
                reason: reason ?? undefined,
            });
            const claim = await repo
                .createQueryBuilder()
                .update(BillPayOrder)
                .set({ status: 'REFUNDED', refundedAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                .execute();
            if ((claim.affected ?? 0) === 0) {
                throw new UserInputError('Bill pay order is not refundable now');
            }
        }
        return (await repo.findOne({ where: { id: order.id } })) as BillPayOrder;
    }

    /** 工作台列表：状态 tab；渠道隔离（超管渠道 1 看全量，对齐 merchantSettlementAdminResolver 口径） */
    async adminList(
        ctx: RequestContext,
        opts: { skip?: number; take?: number; status?: BillPayStatus },
    ): Promise<{ items: BillPayOrder[]; totalItems: number }> {
        const skip = Math.max(0, opts.skip ?? 0);
        const take = Math.min(100, Math.max(1, opts.take ?? 20));
        const qb = this.orderRepo(ctx).createQueryBuilder('o');
        if (Number(ctx.channelId) !== 1) {
            qb.andWhere('o.channelId = :channelId', { channelId: ctx.channelId as any });
        }
        if (opts.status && SETTABLE_STATUSES.includes(opts.status)) {
            qb.andWhere('o.status = :status', { status: opts.status });
        }
        qb.orderBy('o.id', 'DESC').skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async adminFind(ctx: RequestContext, id: ID): Promise<BillPayOrder> {
        return this.loadChannelOrder(ctx, id);
    }

    // ===== 商家协议 =====

    async listAgreements(ctx: RequestContext): Promise<MerchantAgreement[]> {
        const qb = this.connection
            .getRepository(ctx, MerchantAgreement)
            .createQueryBuilder('a');
        if (Number(ctx.channelId) !== 1) {
            qb.andWhere('a.channelId = :channelId', { channelId: ctx.channelId as any });
        }
        return qb.orderBy('a.id', 'DESC').getMany();
    }

    /** 商家协议 upsert：渠道内按商家名唯一 */
    async saveAgreement(
        ctx: RequestContext,
        input: { merchantName: string; settleRate: number; settleMode?: string; contact?: string | null; note?: string | null },
        id?: ID,
    ): Promise<MerchantAgreement> {
        const repo = this.connection.getRepository(ctx, MerchantAgreement);
        const merchantName = String(input.merchantName ?? '').trim();
        const settleRate = Math.round(Number(input.settleRate));
        if (!merchantName) {
            throw new UserInputError('merchantName is required');
        }
        if (!Number.isFinite(settleRate) || settleRate <= 0 || settleRate > 100) {
            throw new UserInputError('settleRate must be 1-100');
        }
        const settleMode = input.settleMode === 'MONTHLY' ? 'MONTHLY' : 'PER_ORDER';
        if (id) {
            const existing = await repo.findOne({ where: { id: id as any } });
            if (!existing) {
                throw new UserInputError('Merchant agreement not found');
            }
            existing.merchantName = merchantName;
            existing.settleRate = settleRate;
            existing.settleMode = settleMode as any;
            existing.contact = input.contact ?? null;
            existing.note = input.note ?? null;
            return repo.save(existing);
        }
        const dup = await repo.findOne({
            where: { channelId: ctx.channelId as any, merchantName },
        });
        if (dup) {
            throw new UserInputError('Merchant agreement already exists for this channel');
        }
        return repo.save(
            new MerchantAgreement({
                channelId: ctx.channelId as number,
                merchantName,
                settleRate,
                settleMode: settleMode as any,
                contact: input.contact ?? null,
                note: input.note ?? null,
            }),
        );
    }

    // ===== 渠道配置（admin）=====

    async getRawChannelConfig(ctx: RequestContext): Promise<BillPayChannelConfig> {
        return this.getChannelConfig(ctx);
    }

    async saveChannelConfig(ctx: RequestContext, config: unknown): Promise<BillPayChannelConfig> {
        const parsed = parseBillPayConfig(config);
        const repo = this.connection.getRepository(ctx, BillPayChannelConfigEntity);
        const row = await repo.findOne({ where: { channelId: ctx.channelId as any } });
        if (row) {
            row.config = JSON.stringify(parsed);
            await repo.save(row);
        } else {
            await repo.save(
                new BillPayChannelConfigEntity({
                    channelId: ctx.channelId as number,
                    config: JSON.stringify(parsed),
                }),
            );
        }
        return parsed;
    }
}
