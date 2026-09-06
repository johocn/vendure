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
exports.RedemptionCodeService = exports.COD_PAYMENT_CODES = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const redemption_crypto_1 = require("./redemption-crypto");
const merchant_settlement_ledger_entity_1 = require("../order/merchant-settlement-ledger.entity");
const loggerCtx = 'RedemptionCodeService';
/** 到店/货到付款（COD）支付方式 code，命中即需收银确认；与 nshop 确认页 & 旧 pickup 收银一致 */
exports.COD_PAYMENT_CODES = [
    'cash-on-delivery',
    'cod',
    'cod-payment-template',
    'cloud-payment-template',
    'fixed-aggregate-collection',
];
let RedemptionCodeService = class RedemptionCodeService {
    constructor(orderService, connection, fulfillmentService) {
        var _a;
        this.orderService = orderService;
        this.connection = connection;
        this.fulfillmentService = fulfillmentService;
        this.keyHex = (_a = process.env.REDEMPTION_KEY) !== null && _a !== void 0 ? _a : '7'.repeat(64); // dev 默认；生产必由运维注入
        if (process.env.REDEMPTION_KEY === undefined && process.env.NODE_ENV === 'production') {
            throw new Error('REDEMPTION_KEY 必须在生产环境注入（32 字节 hex）');
        }
        // 核销有效期：下单后 7 天宽限期；距过期 24 小时起前端进入「即将过期」，可选环境变量覆盖
        this.graceDays = 7;
        this.expireRemindHours = 24;
    }
    cf(order) {
        var _a;
        return ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
    }
    isCodOrder(order) {
        var _a, _b;
        const cf = this.cf(order);
        const method = (_b = ((_a = order.payments) !== null && _a !== void 0 ? _a : [])[0]) === null || _b === void 0 ? void 0 : _b.method;
        return !!exports.COD_PAYMENT_CODES.includes(method) || cf.paymentType === 'cod';
    }
    /**
     * 到店/货到付款收款确认模式：Channel 自定义字段 redeemCollectMode（force/optional）优先，
     * 未配置时回退环境变量 REDEMPTION_COLLECT_MODE=force，默认 optional（只高亮不强制）。
     */
    collectMode(ctx) {
        var _a, _b, _c;
        const chan = (_c = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.redeemCollectMode) !== null && _c !== void 0 ? _c : null;
        if (chan === 'force' || chan === 'optional')
            return chan;
        if (process.env.REDEMPTION_COLLECT_MODE === 'force')
            return 'force';
        return 'optional';
    }
    /** COD 收款后把该订单的分账台账 PENDING_SIGN → PAID（在线支付结算时即 PAID，无需翻转） */
    async flipLedgerToPaid(ctx, orderId) {
        await this.connection
            .getRepository(ctx, merchant_settlement_ledger_entity_1.MerchantSettlementLedger)
            .createQueryBuilder()
            .update(merchant_settlement_ledger_entity_1.MerchantSettlementLedger)
            .set({ status: 'PAID', occurredAt: new Date() })
            .where('orderId = :oid', { oid: String(orderId) })
            .andWhere("status = 'PENDING_SIGN'")
            .execute();
    }
    /**
     * 收款确认后推进订单状态至「已提货（Delivered）」：
     *  - COD（到店/货到付款）先结算 Authorized 支付 → 订单自动 PaymentAuthorized → PaymentSettled；
     *  - 确保存在已送达的 Fulfillment（无则创建）→ 默认履约流程自动把订单推进至 Shipped → Delivered。
     *
     * 幂等：Authorized 才结算、未覆盖行才补建履约、非送达履约才推进；already-created 的履约复用。
     * best-effort：任一步失败只记日志不抛错，不阻塞核销本身（核销已成功）。
     */
    async settleAndDeliver(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            // 1) 结算 COD Authorized 支付 → 订单 PaymentAuthorized → PaymentSettled（经支付流程自动流转）
            if (order.state === 'PaymentAuthorized' && ((_a = order.payments) !== null && _a !== void 0 ? _a : []).length) {
                for (const p of (_b = order.payments) !== null && _b !== void 0 ? _b : []) {
                    if (p.state === 'Authorized') {
                        const res = await this.orderService.settlePayment(ctx, p.id);
                        if ((0, core_1.isGraphQlErrorResult)(res)) {
                            core_1.Logger.warn(`settleAndDeliver: settle payment ${p.id} failed: ${(_c = res.paymentErrorMessage) !== null && _c !== void 0 ? _c : ''}`, loggerCtx);
                        }
                    }
                }
                order = (await this.orderService.findOne(ctx, order.id, ['payments', 'lines', 'fulfillments', 'fulfillments.lines']));
            }
            if (order.state !== 'PaymentSettled' && order.state !== 'Shipped' && order.state !== 'Delivered') {
                core_1.Logger.warn(`settleAndDeliver: order ${order.code} state=${order.state} not advanceable`, loggerCtx);
                return;
            }
            // 2) 推进既有未送达履约（Shipped → Delivered）
            const withF = (await this.orderService.findOne(ctx, order.id, ['lines', 'fulfillments', 'fulfillments.lines']));
            for (const f of (_d = withF === null || withF === void 0 ? void 0 : withF.fulfillments) !== null && _d !== void 0 ? _d : []) {
                if (f.state === 'Shipped') {
                    await this.fulfillmentService.transitionToState(ctx, f.id, 'Delivered');
                }
                else if (f.state === 'Created' || f.state === 'Pending') {
                    const r1 = await this.fulfillmentService.transitionToState(ctx, f.id, 'Shipped');
                    if (r1 && !r1.transitionError) {
                        await this.fulfillmentService.transitionToState(ctx, f.id, 'Delivered');
                    }
                }
            }
            // 3) 对未被送达履约覆盖的行补建履约 → 送抵
            const fresh = (await this.orderService.findOne(ctx, order.id, ['lines', 'fulfillments', 'fulfillments.lines']));
            const remaining = this.pendingFulfillmentLines(fresh);
            if (remaining.length) {
                const handlerCode = 'store-pickup';
                const handler = {
                    code: handlerCode,
                    arguments: [
                        { name: 'storeId', value: String((_f = (_e = order.customFields) === null || _e === void 0 ? void 0 : _e.selectedPickupLocationId) !== null && _f !== void 0 ? _f : '') },
                        { name: 'storeName', value: '门店自提（核销交付）' },
                    ],
                };
                const created = await this.fulfillmentService.create(ctx, [fresh], remaining, handler);
                if (created instanceof core_1.Fulfillment) {
                    const r1 = await this.fulfillmentService.transitionToState(ctx, created.id, 'Shipped');
                    if (!r1 || r1.transitionError) {
                        core_1.Logger.warn(`settleAndDeliver: fulfillment ${created.id} 无法转 Shipped`, loggerCtx);
                    }
                    else {
                        await this.fulfillmentService.transitionToState(ctx, created.id, 'Delivered');
                    }
                }
                else {
                    core_1.Logger.warn(`settleAndDeliver: create fulfillment failed (${handlerCode})`, loggerCtx);
                }
            }
            // 4) 兜底：确保订单落到 Delivered（若因 guard 失败则留待下次 claim 重试，已是 PaymentSettled/Shipped 也算推进）
            const finalOrder = (await this.orderService.findOne(ctx, order.id, []));
            if (finalOrder.state !== 'Delivered') {
                const t = await this.orderService.transitionToState(ctx, order.id, 'Delivered');
                if ((0, core_1.isGraphQlErrorResult)(t)) {
                    core_1.Logger.warn(`settleAndDeliver: order ${order.code} 未能到 Delivered: ${(_g = t.transitionError) !== null && _g !== void 0 ? _g : ''}`, loggerCtx);
                }
            }
        }
        catch (e) {
            core_1.Logger.error(`settleAndDeliver: ${(_h = e === null || e === void 0 ? void 0 : e.message) !== null && _h !== void 0 ? _h : e}`, loggerCtx);
        }
    }
    /** 订单行中尚未被「Delivered」履约完全覆盖的部分；已有送达履约的行不重复履约 */
    pendingFulfillmentLines(order) {
        var _a, _b, _c, _d, _e;
        const covered = new Map();
        for (const f of (_a = order === null || order === void 0 ? void 0 : order.fulfillments) !== null && _a !== void 0 ? _a : []) {
            if (f.state !== 'Delivered')
                continue;
            for (const fLine of (_b = f.lines) !== null && _b !== void 0 ? _b : []) {
                covered.set(String(fLine.orderLineId), ((_c = covered.get(String(fLine.orderLineId))) !== null && _c !== void 0 ? _c : 0) + fLine.quantity);
            }
        }
        const pending = [];
        for (const line of (_d = order === null || order === void 0 ? void 0 : order.lines) !== null && _d !== void 0 ? _d : []) {
            const done = (_e = covered.get(String(line.id))) !== null && _e !== void 0 ? _e : 0;
            const qty = line.quantity - done;
            if (qty > 0)
                pending.push({ orderLineId: line.id, quantity: qty });
        }
        return pending;
    }
    async writeExpiry(ctx, orderId, placedAt) {
        const base = placedAt !== null && placedAt !== void 0 ? placedAt : new Date();
        const expiresAt = new Date(base.getTime() + this.graceDays * 24 * 3600000);
        // 多次调用的保持一致：字段级写 expiresAt，version 不在此递增（重发才 +1）
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemExpiresAt: expiresAt.toISOString(),
        });
    }
    /**
     * 幂等确保订单已生成核销码。返回解密的明文核销码。
     */
    async ensure(ctx, orderId) {
        var _a, _b, _c, _d;
        const order = (await this.orderService.findOne(ctx, orderId, []));
        if (!order)
            throw new Error('order not found');
        const cf = this.cf(order);
        if (cf.redeemCodeCipher && cf.redeemCodeIv) {
            // 历史单缺有效期：补算（幂等；已在生产跑过的单补上 graceDays 起算）
            if (!cf.redeemExpiresAt) {
                await this.writeExpiry(ctx, orderId, order.orderPlacedAt);
            }
            return (0, redemption_crypto_1.decryptRedemptionCode)(cf.redeemCodeCipher, cf.redeemCodeIv, this.keyHex);
        }
        const code = (0, redemption_crypto_1.generateRedemptionCode)();
        const { cipher, iv } = (0, redemption_crypto_1.encryptRedemptionCode)(code, this.keyHex);
        const channelToken = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : String((_c = ctx.channelId) !== null && _c !== void 0 ? _c : '');
        const hash = (0, redemption_crypto_1.redemptionFingerprint)(code, this.keyHex, channelToken);
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemCodeCipher: cipher,
            redeemCodeIv: iv,
            redeemCodeHash: hash,
            redeemExpiresAt: new Date(((_d = order.orderPlacedAt) !== null && _d !== void 0 ? _d : new Date()).getTime() + this.graceDays * 24 * 3600000).toISOString(),
            redeemVersion: 1,
            redeemReissuedAt: new Date().toISOString(),
        });
        return code;
    }
    async getWithQr(ctx, orderId, orderCode) {
        var _a, _b, _c, _d;
        const order = (await this.orderService.findOne(ctx, orderId, ['payments']));
        if (!order)
            throw new Error('order not found');
        const cf = this.cf(order);
        const code = cf.redeemCodeCipher && cf.redeemCodeIv
            ? (0, redemption_crypto_1.decryptRedemptionCode)(cf.redeemCodeCipher, cf.redeemCodeIv, this.keyHex)
            : await this.ensure(ctx, orderId);
        const claimed = !!cf.redeemClaimed;
        const expiresAt = (_a = cf.redeemExpiresAt) !== null && _a !== void 0 ? _a : null;
        const version = Number(cf.redeemVersion) || 1;
        const now = new Date();
        const status = (0, redemption_crypto_1.computeRedemptionStatus)(claimed, expiresAt, now, this.expireRemindHours);
        const collected = !!cf.collected || !!cf.redeemCollected;
        return {
            code,
            qrPayload: (0, redemption_crypto_1.redemptionQrPayload)(orderCode, code, this.keyHex),
            barcode: (0, redemption_crypto_1.redemptionBarcodePayload)(orderCode, code),
            claimed,
            status,
            expiresAt,
            version,
            reissueable: !claimed,
            collected,
            isCod: this.isCodOrder(order),
            paymentType: (_d = (_c = (_b = order.payments) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.method) !== null && _d !== void 0 ? _d : null,
        };
    }
    /**
     * 租户域：本渠道「待核销自提单」列表（含已过期；claimed 者不列出）。
     * 仅 deliveryType=pickup 的订单（cjk 对所有 ArrangingPayment 单生成码，故必须按自提筛选）。
     * Order 按 channelId 归属多租户隔离；码密文解密后回填 code，状态由 computeRedemptionStatus 推导。
     */
    async listPending(ctx, options = {}) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.payments', 'payment')
            .innerJoin('order.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId })
            .where('order.customFields.deliveryType = :deliveryType', { deliveryType: 'pickup' })
            .orderBy('order.orderPlacedAt', 'DESC')
            .addOrderBy('order.id', 'DESC');
        const all = await qb.getMany();
        const now = new Date();
        const pending = all
            .map((o) => {
            var _a, _b, _c, _d, _e;
            const cf = ((_a = o.customFields) !== null && _a !== void 0 ? _a : {});
            let code = '';
            if (cf.redeemCodeCipher && cf.redeemCodeIv) {
                try {
                    code = (0, redemption_crypto_1.decryptRedemptionCode)(cf.redeemCodeCipher, cf.redeemCodeIv, this.keyHex);
                }
                catch (_f) {
                    /* 坏密文 → 无有效码，跳过 */
                }
            }
            const claimed = !!cf.redeemClaimed;
            const expiresAt = (_b = cf.redeemExpiresAt) !== null && _b !== void 0 ? _b : null;
            return {
                orderId: String(o.id),
                orderCode: o.code,
                code,
                status: (0, redemption_crypto_1.computeRedemptionStatus)(claimed, expiresAt, now, this.expireRemindHours),
                expiresAt,
                version: Number(cf.redeemVersion) || 1,
                claimed,
                paymentType: (_e = (_d = ((_c = o.payments) !== null && _c !== void 0 ? _c : [])[0]) === null || _d === void 0 ? void 0 : _d.method) !== null && _e !== void 0 ? _e : null,
                collected: !!cf.collected || !!cf.redeemCollected,
            };
        })
            .filter((it) => it.code && !it.claimed);
        const skip = (_a = options.skip) !== null && _a !== void 0 ? _a : 0;
        const take = (_b = options.take) !== null && _b !== void 0 ? _b : 20;
        return { items: pending.slice(skip, skip + take), totalItems: pending.length };
    }
    /**
     * 管理端按输入码定位（限当前租户 Channel）。返回订单指针或 null。
     * Order 是 ChannelAware（ManyToMany order.channels），按 channelId 归属多租户隔离。
     * redeemCodeHash 存于 Order.customFields jsonb 列，用 jsonb 字段提取（同 sales-plugin 写法）。
     */
    async lookupByCode(ctx, inputCode) {
        var _a, _b, _c;
        const code = inputCode.trim().toUpperCase();
        const channelToken = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : String((_c = ctx.channelId) !== null && _c !== void 0 ? _c : '');
        const hash = (0, redemption_crypto_1.redemptionFingerprint)(code, this.keyHex, channelToken);
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .innerJoin('order.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId })
            .where('order.customFields.redeemCodeHash = :h', { h: hash });
        return qb.getOne();
    }
    /**
     * 到店/货到付款（COD）单核销收款闭环：
     *  - 非 COD 直接核销；
     *  - COD 且未收款：force 模式必须传 collect=true 才放行，否则返回 collectRequired（阻止核销）；
     *    optional 模式允许不收款核销（前端高亮待收款），传 collect=true 时同步确认收款。
     *  - 确认收款后写 order.customFields.collected，并把分账台账 PENDING_SIGN → PAID。
     */
    async claim(ctx, orderId, collect) {
        var _a, _b;
        const order = (await this.orderService.findOne(ctx, orderId, ['payments']));
        if (!order)
            throw new Error('order not found');
        const cf = this.cf(order);
        const already = !!cf.redeemClaimed;
        const isCod = this.isCodOrder(order);
        let collected = !!cf.collected || !!cf.redeemCollected;
        let collectRequired = false;
        if (isCod && !collected) {
            const force = this.collectMode(ctx) === 'force';
            if (force && !collect) {
                // 强制：未确认收款不可核销，前端据此弹「确认收款」对话框
                return { already, claimedAt: (_a = cf.redeemClaimedAt) !== null && _a !== void 0 ? _a : null, collected: false, collectRequired: true };
            }
            if (collect) {
                await this.orderService.updateCustomFields(ctx, orderId, {
                    collected: true,
                    redeemCollectedAt: new Date().toISOString(),
                });
                await this.flipLedgerToPaid(ctx, orderId);
                collected = true;
            }
        }
        let claimedAt = (_b = cf.redeemClaimedAt) !== null && _b !== void 0 ? _b : null;
        if (!already) {
            await this.orderService.updateCustomFields(ctx, orderId, {
                redeemClaimed: true,
                redeemClaimedAt: new Date(),
            });
            claimedAt = new Date();
        }
        // 核销后推进订单状态至「已提货」：在线单直接推进；COD 单需已确认收款（collected）才推进，
        // 未收款的强制/可选单保持 PaymentAuthorized 待收款。已有核销（存量卡单）也在下次 claim 幂等修复。
        if (!isCod || collected) {
            await this.settleAndDeliver(ctx, order);
        }
        return { already, claimedAt, collected, collectRequired: false };
    }
    /**
     * 作废重发：已核销单禁止重发（一次性闭环）。新码重算密文/指纹并覆盖 → lookupByCode 命中激活码，旧码自然失效。
     */
    async reissue(ctx, orderId) {
        var _a, _b, _c;
        const order = (await this.orderService.findOne(ctx, orderId, []));
        if (!order)
            throw new Error('order not found');
        const cf = this.cf(order);
        if (cf.redeemClaimed) {
            throw new Error('redemption.already_claimed');
        }
        const orderCode = order.code;
        const code = (0, redemption_crypto_1.generateRedemptionCode)();
        const { cipher, iv } = (0, redemption_crypto_1.encryptRedemptionCode)(code, this.keyHex);
        const channelToken = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : String((_c = ctx.channelId) !== null && _c !== void 0 ? _c : '');
        const hash = (0, redemption_crypto_1.redemptionFingerprint)(code, this.keyHex, channelToken);
        const version = (Number(cf.redeemVersion) || 1) + 1;
        const expiresAt = new Date(new Date().getTime() + this.graceDays * 24 * 3600000).toISOString();
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemCodeCipher: cipher,
            redeemCodeIv: iv,
            redeemCodeHash: hash,
            redeemVersion: version,
            redeemReissuedAt: new Date(),
            redeemExpiresAt: expiresAt,
        });
        return {
            code,
            qrPayload: (0, redemption_crypto_1.redemptionQrPayload)(orderCode, code, this.keyHex),
            barcode: (0, redemption_crypto_1.redemptionBarcodePayload)(orderCode, code),
            claimed: false,
            status: 'active',
            expiresAt,
            version,
            reissueable: true,
        };
    }
};
exports.RedemptionCodeService = RedemptionCodeService;
exports.RedemptionCodeService = RedemptionCodeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.OrderService,
        core_1.TransactionalConnection,
        core_1.FulfillmentService])
], RedemptionCodeService);
//# sourceMappingURL=redemption-code.service.js.map