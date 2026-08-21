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
exports.VoucherService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const voucher_options_1 = require("./voucher.options");
const service_voucher_entity_1 = require("./service-voucher.entity");
const voucher_booking_entity_1 = require("./voucher-booking.entity");
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_EFFECTIVE_DAYS = 90;
const MS_PER_DAY = 86400000;
let VoucherService = class VoucherService {
    constructor(options, connection, orderService, administratorService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
        this.administratorService = administratorService;
    }
    // ---------- 店主域鉴权 ----------
    /** 归属解析 + 校验：activeUserId → Administrator.user → Shop.administratorId → status==='active'。 */
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
    // ---------- 券生成（PaymentSettled 联动） ----------
    /**
     * 幂等生成：按 orderId 查 ServiceVoucher，存在即返回；否则遍历订单行，仅对
     * 「Product.customFields.serviceType 非空」的服务型商品每件生成一张券（阶段22 铁律：
     * OrderLine 无私货 productId，须走 line.productVariant.product）。
     */
    async getOrCreateVouchersForOrder(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g;
        const orderId = order.id;
        const repo = this.connection.getRepository(ctx, service_voucher_entity_1.ServiceVoucher);
        const existing = await repo.find({ where: { orderId } });
        if (existing.length > 0) {
            return existing; // 幂等：一单一轮最多生成一次
        }
        const fresh = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.product.translations',
            'lines.productVariant.translations',
        ]);
        if (!fresh)
            return [];
        const customerId = (_a = fresh.customer) === null || _a === void 0 ? void 0 : _a.id;
        const effectiveDays = (_b = this.options.defaultEffectiveDays) !== null && _b !== void 0 ? _b : DEFAULT_EFFECTIVE_DAYS;
        const expiresAt = new Date(Date.now() + effectiveDays * MS_PER_DAY);
        const vouchers = [];
        for (const line of (_c = fresh.lines) !== null && _c !== void 0 ? _c : []) {
            const product = (_d = line.productVariant) === null || _d === void 0 ? void 0 : _d.product;
            const cf = ((_e = product === null || product === void 0 ? void 0 : product.customFields) !== null && _e !== void 0 ? _e : {});
            const serviceType = cf.serviceType;
            if (!serviceType)
                continue; // 非服务型商品不生成券
            const shopIdVal = cf.shopId;
            if (shopIdVal == null)
                continue; // 未归属店铺的服务券不生成
            const shopId = Number(shopIdVal);
            const productVoucherName = this.pickName(product === null || product === void 0 ? void 0 : product.translations, ctx.languageCode) ||
                this.pickName((_f = line.productVariant) === null || _f === void 0 ? void 0 : _f.translations, ctx.languageCode) ||
                '';
            for (let i = 0; i < line.quantity; i++) {
                const voucher = repo.create({
                    channelId: ctx.channelId,
                    orderId,
                    customerId,
                    shopId,
                    productVariantId: (_g = line.productVariant) === null || _g === void 0 ? void 0 : _g.id,
                    productVoucherName,
                    code: await this.genUniqueCode(ctx, repo),
                    status: 'usable',
                    effectiveDays,
                    expiresAt,
                });
                voucher.channels = [ctx.channel];
                vouchers.push(await repo.save(voucher));
            }
        }
        return vouchers;
    }
    // ---------- 店主核销 / 展示 / 变更 ----------
    /** 核销：店主在其店内找 code 对应券，usable → used+usedAt。 */
    async redeemVoucher(ctx, code) {
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, service_voucher_entity_1.ServiceVoucher);
        const voucher = await repo.findOne({ where: { code, shopId: shop.id } });
        if (!voucher)
            throw new core_1.EntityNotFoundError('ServiceVoucher', code);
        if (voucher.status !== 'usable') {
            throw new core_1.UserInputError(`Voucher is not usable (current status: ${voucher.status})`);
        }
        voucher.status = 'used';
        voucher.usedAt = new Date();
        return repo.save(voucher);
    }
    /** 扫码展示：店主在其店内按 code 查回，未命中返回 undefined。 */
    async findVoucher(ctx, code) {
        const shop = await this.requireMyShop(ctx);
        const voucher = await this.connection
            .getRepository(ctx, service_voucher_entity_1.ServiceVoucher)
            .findOne({ where: { code, shopId: shop.id } });
        return voucher !== null && voucher !== void 0 ? voucher : undefined;
    }
    /** 延期：used 不可延，expiresAt += days。 */
    async extendVoucher(ctx, voucherId, days) {
        var _a;
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, service_voucher_entity_1.ServiceVoucher);
        const voucher = await repo.findOne({ where: { id: Number(voucherId), shopId: shop.id } });
        if (!voucher)
            throw new core_1.EntityNotFoundError('ServiceVoucher', voucherId);
        if (voucher.status === 'used') {
            throw new core_1.UserInputError('Used voucher cannot be extended');
        }
        const base = (_a = voucher.expiresAt) !== null && _a !== void 0 ? _a : new Date();
        voucher.expiresAt = new Date(base.getTime() + days * MS_PER_DAY);
        return repo.save(voucher);
    }
    /** 换券：旧券置 voided，新建同信息新券（新 code，status usable，expiresAt 重置）。 */
    async exchangeVoucher(ctx, voucherId) {
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, service_voucher_entity_1.ServiceVoucher);
        const voucher = await repo.findOne({ where: { id: Number(voucherId), shopId: shop.id } });
        if (!voucher)
            throw new core_1.EntityNotFoundError('ServiceVoucher', voucherId);
        voucher.status = 'voided';
        await repo.save(voucher);
        const effectiveDays = voucher.effectiveDays;
        const next = repo.create({
            channelId: voucher.channelId,
            orderId: voucher.orderId, // 换券继承原单归属，保证 orderId 非空
            customerId: voucher.customerId,
            shopId: voucher.shopId,
            productVariantId: voucher.productVariantId,
            productVoucherName: voucher.productVoucherName,
            code: await this.genUniqueCode(ctx, repo),
            status: 'usable',
            effectiveDays,
            expiresAt: new Date(Date.now() + effectiveDays * MS_PER_DAY),
        });
        next.channels = [ctx.channel];
        return repo.save(next);
    }
    /** 过期扫描：usable 且 expiresAt < now → expired。返回处理条数（JobQueue/admin mutation 调用）。 */
    async markExpired(_ctx) {
        const repo = this.connection.rawConnection.getRepository(service_voucher_entity_1.ServiceVoucher);
        const rows = await repo.find({ where: { status: 'usable' } });
        let count = 0;
        const now = Date.now();
        for (const v of rows) {
            if (v.expiresAt && v.expiresAt.getTime() < now) {
                v.status = 'expired';
                await repo.save(v);
                count++;
            }
        }
        return count;
    }
    /** 退款成功联动：该单全部 usable 券 → refunded+refundedAt（RefundStateTransitionEvent Settled 订阅调用）。 */
    async markRefundedOnOrder(ctx, orderId) {
        const repo = this.connection.getRepository(ctx, service_voucher_entity_1.ServiceVoucher);
        const rows = await repo.find({ where: { orderId: Number(orderId), status: 'usable' } });
        let count = 0;
        for (const v of rows) {
            v.status = 'refunded';
            v.refundedAt = new Date();
            await repo.save(v);
            count++;
        }
        return count;
    }
    // ---------- 预约 ----------
    /** 建预约（幂等：一券最多一档）。 */
    async createBooking(ctx, voucherId, slotAt, customerCount) {
        const repo = this.connection.getRepository(ctx, voucher_booking_entity_1.VoucherBooking);
        const existing = await repo.findOne({ where: { voucherId: Number(voucherId) } });
        if (existing)
            return existing;
        const voucher = await this.connection
            .getRepository(ctx, service_voucher_entity_1.ServiceVoucher)
            .findOne({ where: { id: Number(voucherId) } });
        if (!voucher)
            throw new core_1.EntityNotFoundError('ServiceVoucher', voucherId);
        const booking = repo.create({
            channelId: ctx.channelId,
            voucherId: voucher.id,
            customerId: voucher.customerId,
            shopId: voucher.shopId,
            slotAt: new Date(slotAt),
            customerCount,
        });
        booking.channels = [ctx.channel];
        return repo.save(booking);
    }
    /** 查询某券的预约档。 */
    async bookingsForVoucher(ctx, voucherId) {
        return this.connection
            .getRepository(ctx, voucher_booking_entity_1.VoucherBooking)
            .find({ where: { voucherId: Number(voucherId) } });
    }
    // ---------- C 端 ----------
    /** C 端当前顾客券列表：customerId = activeUserId 对应用户的 Customer（按 customer.user.id 关联）。 */
    async myVouchers(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.connection
            .getRepository(ctx, core_1.Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } });
        if (!customer)
            return [];
        return this.connection.getRepository(ctx, service_voucher_entity_1.ServiceVoucher).find({
            where: { customerId: customer.id, channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
        });
    }
    /** 管理端全局券列表（本 channel）。 */
    async vouchers(ctx) {
        return this.connection.getRepository(ctx, service_voucher_entity_1.ServiceVoucher).find({
            where: { channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
        });
    }
    // ---------- 私有助手 ----------
    pickName(translations, lang) {
        var _a, _b;
        const t = (_a = (translations !== null && translations !== void 0 ? translations : []).find(tr => (tr === null || tr === void 0 ? void 0 : tr.languageCode) === lang)) !== null && _a !== void 0 ? _a : (translations !== null && translations !== void 0 ? translations : [])[0];
        return (_b = t === null || t === void 0 ? void 0 : t.name) !== null && _b !== void 0 ? _b : '';
    }
    /** 保证唯一核销码：时间戳+随机，冲突重试。 */
    async genUniqueCode(ctx, repo) {
        for (let i = 0; i < 10; i++) {
            const ts = Date.now().toString(36).toUpperCase();
            let rnd = '';
            for (let j = 0; j < 6; j++) {
                rnd += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            }
            const code = `${ts}${rnd}`;
            const hit = await repo.findOne({ where: { code } });
            if (!hit)
                return code;
        }
        throw new core_1.UserInputError('Failed to generate a unique voucher code');
    }
};
exports.VoucherService = VoucherService;
exports.VoucherService = VoucherService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(voucher_options_1.VOUCHER_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.AdministratorService])
], VoucherService);
//# sourceMappingURL=voucher.service.js.map