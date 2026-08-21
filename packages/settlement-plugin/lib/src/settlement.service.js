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
exports.SettlementService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const shop_plugin_1 = require("@vendure/shop-plugin");
const constants_1 = require("./constants");
const merchant_account_entity_1 = require("./merchant-account.entity");
const settlement_entry_entity_1 = require("./settlement-entry.entity");
const withdrawal_request_entity_1 = require("./withdrawal-request.entity");
/**
 * 商家财务对账编排：订单 completed 口径按店入账 + 提现流转。
 * 店主归属：Shop.administratorId（阶段18 账权），复用 manageOwnShop 权限。
 * 平台操作：@Allow(Permission.UpdateSettings)。
 */
let SettlementService = class SettlementService {
    constructor(options, connection, orderService, administratorService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
        this.administratorService = administratorService;
    }
    /** 订单完成履结 → 按店入账（幂等：orderId×shopId unique，仅新建明细时累加账户）。 */
    async handleOrderSettled(ctx, orderId) {
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
        ]);
        if (!order) {
            return;
        }
        const agg = await this.resolveShopAggregation(ctx, order);
        if (agg.length === 0) {
            return;
        }
        const orderCode = order.code;
        const entryRepo = this.connection.getRepository(ctx, settlement_entry_entity_1.SettlementEntry);
        for (const { shopId, goodsAmountWithTax, shippingAmountWithTax } of agg) {
            const exists = await entryRepo.findOne({
                where: { orderId: Number(orderId), shopId },
            });
            if (exists) {
                // 幂等：已入账，跳过（不重复累加）
                continue;
            }
            const account = await this.getOrCreateAccount(ctx, shopId);
            const rate = account.commissionRate;
            const gross = goodsAmountWithTax + shippingAmountWithTax;
            const commissionAmount = Math.round((gross * rate) / 100);
            const netAmountWithTax = gross - commissionAmount;
            const entry = new settlement_entry_entity_1.SettlementEntry({
                channelId: ctx.channelId,
                shopId,
                orderId: Number(orderId),
                orderCode,
                goodsAmountWithTax,
                shippingAmountWithTax,
                commissionAmount,
                netAmountWithTax,
                settledAt: new Date(),
            });
            await entryRepo.save(entry);
            // 账户余额/累计：仅在新建明细后累加一次
            account.availableBalance += netAmountWithTax;
            account.totalGoodsAmount += goodsAmountWithTax;
            account.totalShippingAmount += shippingAmountWithTax;
            account.totalCommission += commissionAmount;
            await this.connection.getRepository(ctx, merchant_account_entity_1.MerchantAccount).save(account);
        }
    }
    // ---------- 店主域（requireMyShop） ----------
    async myAccount(ctx) {
        const shop = await this.requireMyShop(ctx);
        return this.getOrCreateAccount(ctx, shop.id);
    }
    async mySettlementEntries(ctx, options) {
        const shop = await this.requireMyShop(ctx);
        return this.listEntries(ctx, shop.id, options);
    }
    async myWithdrawalRequests(ctx, options) {
        var _a, _b;
        const shop = await this.requireMyShop(ctx);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest)
            .findAndCount({
            where: { shopId: shop.id, channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async requestWithdrawal(ctx, amount) {
        const shop = await this.requireMyShop(ctx);
        const account = await this.getOrCreateAccount(ctx, shop.id);
        if (amount <= 0) {
            throw new core_1.UserInputError('Withdrawal amount must be positive');
        }
        if (amount > account.availableBalance) {
            throw new core_1.UserInputError('Insufficient balance');
        }
        const w = new withdrawal_request_entity_1.WithdrawalRequest({
            channelId: ctx.channelId,
            shopId: shop.id,
            amount,
            status: 'pending',
        });
        return this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest).save(w);
    }
    async mySettlementSummary(ctx, from, to) {
        const shop = await this.requireMyShop(ctx);
        return this.summary(ctx, shop.id, from, to);
    }
    // ---------- 平台管理端（UpdateSettings） ----------
    async accounts(ctx, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection
            .getRepository(ctx, merchant_account_entity_1.MerchantAccount)
            .findAndCount({
            where: { channelId: ctx.channelId },
            order: { id: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async entriesByShop(ctx, shopId, options) {
        return this.listEntries(ctx, Number(shopId), options);
    }
    async allWithdrawalRequests(ctx, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection
            .getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest)
            .findAndCount({
            where: { channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async approveWithdrawal(ctx, id) {
        const w = await this.getWithdrawalOrThrow(ctx, id);
        this.assertTransition(w.status, 'approved');
        w.status = 'approved';
        return this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest).save(w);
    }
    async payWithdrawal(ctx, id) {
        const w = await this.getWithdrawalOrThrow(ctx, id);
        this.assertTransition(w.status, 'paid');
        const account = await this.getOrCreateAccount(ctx, w.shopId);
        if (w.amount > account.availableBalance) {
            throw new core_1.UserInputError('Insufficient balance');
        }
        account.availableBalance -= w.amount;
        account.totalWithdrawn += w.amount;
        await this.connection.getRepository(ctx, merchant_account_entity_1.MerchantAccount).save(account);
        w.status = 'paid';
        w.paidAt = new Date();
        return this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest).save(w);
    }
    async rejectWithdrawal(ctx, id, note) {
        const w = await this.getWithdrawalOrThrow(ctx, id);
        this.assertTransition(w.status, 'rejected');
        w.status = 'rejected';
        w.reviewNote = note !== null && note !== void 0 ? note : null;
        return this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest).save(w);
    }
    async setMerchantCommissionRate(ctx, shopId, rate) {
        if (rate < 0 || rate > 100) {
            throw new core_1.UserInputError('Commission rate must be between 0 and 100');
        }
        const account = await this.getOrCreateAccount(ctx, Number(shopId));
        account.commissionRate = rate;
        return this.connection.getRepository(ctx, merchant_account_entity_1.MerchantAccount).save(account);
    }
    // ---------- 私有工具 ----------
    async getOrCreateAccount(ctx, shopId) {
        var _a;
        const repo = this.connection.getRepository(ctx, merchant_account_entity_1.MerchantAccount);
        const existing = await repo.findOne({
            where: { shopId, channelId: ctx.channelId },
        });
        if (existing) {
            return existing;
        }
        const account = new merchant_account_entity_1.MerchantAccount({
            channelId: ctx.channelId,
            shopId,
            commissionRate: (_a = this.options.defaultCommissionRate) !== null && _a !== void 0 ? _a : 0,
            availableBalance: 0,
            totalGoodsAmount: 0,
            totalShippingAmount: 0,
            totalCommission: 0,
            totalWithdrawn: 0,
        });
        return repo.save(account);
    }
    async listEntries(ctx, shopId, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection
            .getRepository(ctx, settlement_entry_entity_1.SettlementEntry)
            .findAndCount({
            where: { shopId, channelId: ctx.channelId },
            order: { settledAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async summary(ctx, shopId, from, to) {
        const where = { shopId, channelId: ctx.channelId };
        if (from || to) {
            where.settledAt = {};
            if (from)
                where.settledAt.gte = from;
            if (to)
                where.settledAt.lte = to;
        }
        const entries = await this.connection
            .getRepository(ctx, settlement_entry_entity_1.SettlementEntry)
            .find({ where });
        const sum = (k) => entries.reduce((acc, e) => { var _a; return acc + Number((_a = e[k]) !== null && _a !== void 0 ? _a : 0); }, 0);
        return {
            goodsAmountWithTax: sum('goodsAmountWithTax'),
            shippingAmountWithTax: sum('shippingAmountWithTax'),
            commissionAmount: sum('commissionAmount'),
            netAmountWithTax: sum('netAmountWithTax'),
        };
    }
    async getWithdrawalOrThrow(ctx, id) {
        return this.connection.getEntityOrThrow(ctx, withdrawal_request_entity_1.WithdrawalRequest, id);
    }
    assertTransition(from, to) {
        var _a;
        const allowed = {
            pending: ['approved', 'rejected'],
            approved: ['paid'],
        };
        const next = (_a = allowed[from]) !== null && _a !== void 0 ? _a : [];
        if (!next.includes(to)) {
            throw new core_1.UserInputError(`Cannot transition withdrawal from "${from}" to "${to}"`);
        }
    }
    async requireMyShop(ctx) {
        // 复用 shop-plugin 阶段18 账权语义（Shop.administratorId 归属 + active 校验）。
        // 不直接注入 ShopService（跨插件模块不可注入），依核心服务/仓储复刻 resolveMyShopFromActiveUser + requireMyShop。
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null) {
            throw new core_1.ForbiddenError();
        }
        const shop = await this.connection
            .getRepository(ctx, shop_plugin_1.Shop)
            .findOne({ where: { administratorId: admin.id } });
        if (!shop || shop.status !== 'active') {
            throw new core_1.ForbiddenError();
        }
        return shop;
    }
    async resolveShopAggregation(ctx, order) {
        var _a, _b, _c, _d, _e;
        const lines = ((_a = order === null || order === void 0 ? void 0 : order.lines) !== null && _a !== void 0 ? _a : []);
        const productIds = [
            ...new Set(lines.map((l) => { var _a; return Number((_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.productId) || Number(l.productId); }).filter((id) => id > 0)),
        ];
        const shopByProduct = new Map();
        if (productIds.length > 0) {
            const products = await this.connection
                .getRepository(ctx, core_1.Product)
                .find({ where: { id: (0, typeorm_1.In)(productIds) } });
            for (const p of products) {
                const sid = (_c = (((_b = p.customFields) !== null && _b !== void 0 ? _b : {}))) === null || _c === void 0 ? void 0 : _c.shopId;
                if (sid != null) {
                    shopByProduct.set(Number(p.id), Number(sid));
                }
            }
        }
        const subtotals = new Map();
        for (const l of lines) {
            const pid = Number((_d = l.productVariant) === null || _d === void 0 ? void 0 : _d.productId) || Number(l.productId);
            const sid = shopByProduct.get(pid);
            if (sid == null) {
                continue; // 商品未归属店铺 → skip
            }
            subtotals.set(sid, ((_e = subtotals.get(sid)) !== null && _e !== void 0 ? _e : 0) + (Number(l.linePriceWithTax) || 0));
        }
        // 运费按商品小计占比分摊给各店，末店抹平误差保证合计=订单运费
        const goodsSum = [...subtotals.values()].reduce((a, b) => a + b, 0);
        const totalShip = Number(order.shippingWithTax) || 0;
        const out = [];
        let allocated = 0;
        const keys = [...subtotals.keys()];
        for (let i = 0; i < keys.length; i++) {
            const shopId = keys[i];
            const goods = subtotals.get(shopId);
            let share = 0;
            if (goodsSum > 0 && totalShip > 0) {
                share = i === keys.length - 1
                    ? totalShip - allocated
                    : Math.round((goods / goodsSum) * totalShip);
            }
            allocated += share;
            out.push({ shopId, goodsAmountWithTax: goods, shippingAmountWithTax: share });
        }
        return out;
    }
};
exports.SettlementService = SettlementService;
exports.SettlementService = SettlementService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.SETTLEMENT_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.AdministratorService])
], SettlementService);
//# sourceMappingURL=settlement.service.js.map