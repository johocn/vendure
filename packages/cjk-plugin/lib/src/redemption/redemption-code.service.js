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
exports.RedemptionCodeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const redemption_crypto_1 = require("./redemption-crypto");
let RedemptionCodeService = class RedemptionCodeService {
    constructor(orderService, connection) {
        var _a;
        this.orderService = orderService;
        this.connection = connection;
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
        var _a;
        const order = (await this.orderService.findOne(ctx, orderId, []));
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
        return {
            code,
            qrPayload: (0, redemption_crypto_1.redemptionQrPayload)(orderCode, code, this.keyHex),
            barcode: (0, redemption_crypto_1.redemptionBarcodePayload)(orderCode, code),
            claimed,
            status,
            expiresAt,
            version,
            reissueable: !claimed,
        };
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
    async claim(ctx, orderId) {
        const order = (await this.orderService.findOne(ctx, orderId, []));
        if (!order)
            throw new Error('order not found');
        const cf = this.cf(order);
        if (cf.redeemClaimed)
            return { already: true, claimedAt: cf.redeemClaimedAt };
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemClaimed: true,
            redeemClaimedAt: new Date(),
        });
        return { already: false, claimedAt: new Date() };
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
        core_1.TransactionalConnection])
], RedemptionCodeService);
//# sourceMappingURL=redemption-code.service.js.map