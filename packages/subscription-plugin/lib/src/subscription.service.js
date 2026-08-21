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
exports.SubscriptionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const constants_1 = require("./constants");
const subscription_occurrence_entity_1 = require("./subscription-occurrence.entity");
const subscription_plan_entity_1 = require("./subscription-plan.entity");
const subscription_entity_1 = require("./subscription.entity");
/**
 * 周期购/订阅复购核心：买断开通（购审 + 展开排期）、每期生成正式订单并抵扣预存款、
 * 每日调度扫到期期次、续订确认、取消、平台/店主/买家查询，以及 requireMyShop 归属隔离。
 */
let SubscriptionService = class SubscriptionService {
    constructor(options, connection, orderService, administratorService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
        this.administratorService = administratorService;
    }
    /** 从 startDate 出发按频次展开 N 个期次日（不含 startDate 当日之前）。 */
    expandSchedule(frequency, periods, startDate) {
        const dates = [];
        let cursor = new Date(startDate);
        let guard = 0;
        while (dates.length < periods && guard < periods * 400) {
            cursor = this.nextDate(frequency, cursor);
            dates.push(cursor);
            guard++;
        }
        return dates;
    }
    nextDate(frequency, from) {
        const d = new Date(from);
        switch (frequency.kind) {
            case 'daily':
                d.setDate(d.getDate() + 1);
                break;
            case 'weekly': {
                const target = frequency.dayOfWeek; // 0=Sun..6=Sat
                const cur = d.getDay();
                let add = (target - cur + 7) % 7;
                if (add === 0)
                    add = 7;
                d.setDate(d.getDate() + add);
                break;
            }
            case 'everyNDays':
                d.setDate(d.getDate() + frequency.interval);
                break;
            default:
                throw new core_1.UserInputError('Unsupported frequency');
        }
        d.setHours(0, 0, 0, 0);
        return d;
    }
    /**
     * 买断开通：创建 Subscription（active）+ 展开排期生成 1..N 个 pending 期次。
     * 平台统一征收（collectBuyoutCentrally 为 true 时预存款初始化为买断总价）。
     */
    async createSubscription(ctx, customerId, planId, startDate) {
        var _a, _b;
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const plan = await this.connection.getRepository(ctx, subscription_plan_entity_1.SubscriptionPlan).findOne({
            where: { id: Number(planId), channelId: ctx.channelId, enabled: true },
        });
        if (!plan) {
            throw new core_1.UserInputError('Plan not found or disabled');
        }
        const subRepo = this.connection.getRepository(ctx, subscription_entity_1.Subscription);
        const total = plan.periods * plan.periodPrice;
        const start = new Date(startDate);
        const schedule = this.expandSchedule(plan.frequency, plan.periods, start);
        const sub = new subscription_entity_1.Subscription({
            channelId: ctx.channelId,
            code: `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            planId: plan.id,
            shopId: plan.shopId,
            customerId,
            scheduleJson: schedule.map((d) => d.toISOString()),
            startDate: (_a = schedule[0]) !== null && _a !== void 0 ? _a : start,
            endDate: (_b = schedule[schedule.length - 1]) !== null && _b !== void 0 ? _b : start,
            prepaidBalance: this.options.collectBuyoutCentrally === false ? 0 : total,
            purchasedTotal: total,
            status: 'active',
        });
        const saved = await subRepo.save(sub);
        const occRepo = this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence);
        for (let i = 0; i < schedule.length; i++) {
            await occRepo.save(new subscription_occurrence_entity_1.SubscriptionOccurrence({
                channelId: ctx.channelId,
                subscriptionId: saved.id,
                periodNo: i + 1,
                scheduledDate: schedule[i],
                status: 'pending',
            }));
        }
        return saved;
    }
    /**
     * 每日调度 / 手动驱动：扫所有到期 pending 期次。
     * 卖家未指定内容 → skipped；已指定 → createFormalOrder + deductPrepaid。
     */
    async processDueOccurrences(ctx, asOf = new Date()) {
        var _a;
        const occRepo = this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence);
        // 注：sql.js 无法把 Date 对象绑定进 where（lessThanOrEqual）参数，故先取全部 pending、在内存按时间过滤。
        const pendings = await occRepo.find({
            where: { status: 'pending' },
            order: { scheduledDate: 'ASC' },
        });
        const due = pendings.filter(o => new Date(o.scheduledDate).getTime() <= asOf.getTime());
        let created = 0;
        let skipped = 0;
        for (const occ of due) {
            const items = ((_a = occ.sellerItemsJson) !== null && _a !== void 0 ? _a : []);
            if (items.length === 0) {
                occ.status = 'skipped';
                occ.skipReason = 'seller items not set';
                await occRepo.save(occ);
                skipped++;
                continue;
            }
            const order = await this.createFormalOrder(ctx, occ, items);
            occ.status = 'orderCreated';
            occ.generatedOrderId = order.id;
            occ.orderCode = order.code;
            await occRepo.save(occ);
            await this.deductPrepaid(ctx, occ.subscriptionId, occ.periodNo, occ);
            created++;
        }
        return { created, skipped };
    }
    /** 用 OrderService 建正式订单并加入期次清单，补全收货地址/运费/支付后推进到 PaymentSettled。 */
    async createFormalOrder(ctx, occ, items) {
        const sub = await this.connection.getRepository(ctx, subscription_entity_1.Subscription).findOne({ where: { id: occ.subscriptionId } });
        if (!sub) {
            throw new core_1.UserInputError('Subscription not found');
        }
        // 交易内构建订单（addPaymentToOrder 需事务 ctx），失败整体回滚不残留半成品订单。
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const order = await this.orderService.create(txCtx, sub.customerId);
            for (const it of items) {
                const addRes = await this.orderService.addItemToOrder(txCtx, order.id, it.variantId, it.quantity);
                if (!addRes || addRes.id == null) {
                    throw new core_1.UserInputError('Failed to add item to subscription order');
                }
            }
            await this.orderService.setShippingAddress(txCtx, order.id, this.defaultShippingAddress());
            const quotes = await this.orderService.getEligibleShippingMethods(txCtx, order.id);
            if (quotes.length) {
                const shipRes = await this.orderService.setShippingMethod(txCtx, order.id, [quotes[0].id]);
                if (shipRes && shipRes.errorCode) {
                    throw new core_1.UserInputError('Failed to set shipping method');
                }
            }
            await this.transitionToStateChecked(txCtx, order.id, 'ArrangingPayment');
            const pmCode = await this.resolvePaymentMethodCode(txCtx);
            const payRes = await this.orderService.addPaymentToOrder(txCtx, order.id, { method: pmCode, metadata: {} });
            if (!payRes || payRes.id == null) {
                throw new core_1.UserInputError('Failed to add payment to subscription order');
            }
            await this.transitionToStateChecked(txCtx, order.id, 'PaymentSettled');
            return this.orderService.findOne(txCtx, order.id);
        });
    }
    /** 从插件配置或当前 channel 已启用支付方式中解析支付方式 code，用于 Buyout 统一采集。 */
    async resolvePaymentMethodCode(ctx) {
        if (this.options.paymentMethodCode) {
            return this.options.paymentMethodCode;
        }
        const methods = await this.connection.getRepository(ctx, core_1.PaymentMethod).find({
            order: { id: 'ASC' },
            take: 1,
        });
        const method = methods[0];
        if (!(method === null || method === void 0 ? void 0 : method.code)) {
            throw new core_1.UserInputError('No payment method available for subscription order');
        }
        return method.code;
    }
    /** 期次订单默认收货地址（买到到店无需真实门牌，仅占位）。 */
    defaultShippingAddress() {
        return {
            fullName: 'Subscription Buyer',
            streetLine1: '1 Test Street',
            city: 'Springfield',
            postalCode: '00000',
            countryCode: 'US',
        };
    }
    /** 过渡订单状态；已在目标态则视为成功，否则抛错以触发创建事务回滚。 */
    async transitionToStateChecked(ctx, orderId, state) {
        var _a, _b;
        const res = await this.orderService.transitionToState(ctx, orderId, state);
        if (!res || res.id == null) {
            const current = await this.orderService.findOne(ctx, orderId);
            const text = (_b = (_a = res === null || res === void 0 ? void 0 : res.transitionError) !== null && _a !== void 0 ? _a : res === null || res === void 0 ? void 0 : res.message) !== null && _b !== void 0 ? _b : 'order transition failed';
            if (!current || String(current.state) !== state) {
                throw new core_1.UserInputError(`Order transition to "${state}" failed: ${text}`);
            }
        }
    }
    /** 每期按 periodPrice 抵扣预存款；余额不足则回滚期次 pending 并抛错。 */
    async deductPrepaid(ctx, subscriptionId, periodNo, occ) {
        var _a;
        const subRepo = this.connection.getRepository(ctx, subscription_entity_1.Subscription);
        const sub = await subRepo.findOne({ where: { id: subscriptionId } });
        if (!sub) {
            throw new core_1.UserInputError('Subscription not found');
        }
        const planRepo = this.connection.getRepository(ctx, subscription_plan_entity_1.SubscriptionPlan);
        const plan = await planRepo.findOne({ where: { id: sub.planId } });
        const periodPrice = (_a = plan === null || plan === void 0 ? void 0 : plan.periodPrice) !== null && _a !== void 0 ? _a : 0;
        if (sub.prepaidBalance < periodPrice) {
            // 余额不足：期次维持 pending，不部分抵扣
            occ.status = 'pending';
            await this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence).save(occ);
            throw new core_1.UserInputError('Insufficient prepaid balance');
        }
        sub.prepaidBalance -= periodPrice;
        // 全部期次抵扣完毕 → 本段到期
        if (sub.prepaidBalance <= 0) {
            sub.status = 'expired';
        }
        await subRepo.save(sub);
    }
    /** 店主为本店某期次指定商品清单（归属校验在外层 resolver）。 */
    async setOccurrenceItems(ctx, occId, items) {
        const occ = await this.connection.getEntityOrThrow(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence, occId);
        if (occ.status !== 'pending') {
            throw new core_1.UserInputError('Only pending occurrence items can be set');
        }
        occ.sellerItemsJson = items;
        return this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence).save(occ);
    }
    /**
     * 店主为本店某期次指定商品清单（归属隔离强制在业务层）。
     * requireMyShop 拿到店主所属店 → 校验该期次所属订阅的 shopId === 店主所属店，否则 ForbiddenError。
     */
    async ownerSetOccurrenceItems(ctx, occId, items) {
        const shop = await this.requireMyShop(ctx);
        const occRepo = this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence);
        const occ = await occRepo.findOne({ where: { id: Number(occId) } });
        if (!occ) {
            throw new core_1.UserInputError('Occurrence not found');
        }
        const sub = await this.connection.getRepository(ctx, subscription_entity_1.Subscription).findOne({
            where: { id: occ.subscriptionId },
        });
        const subShopId = sub === null || sub === void 0 ? void 0 : sub.shopId;
        if (subShopId == null || subShopId !== shop.id) {
            throw new core_1.ForbiddenError();
        }
        return this.setOccurrenceItems(ctx, occId, items);
    }
    /** 最后一期履约后进入续订待定；买家确认开启新一段（沿用 createSubscription）。 */
    async initiateRenewal(ctx, subscriptionId) {
        const subRepo = this.connection.getRepository(ctx, subscription_entity_1.Subscription);
        const sub = await subRepo.findOne({ where: { id: Number(subscriptionId) } });
        if (!sub) {
            throw new core_1.UserInputError('Subscription not found');
        }
        sub.status = 'renewalPending';
        return subRepo.save(sub);
    }
    /** 取消：status → cancelled，并把所有 pending 期次 → cancelled。 */
    async cancelSubscription(ctx, subscriptionId) {
        const subRepo = this.connection.getRepository(ctx, subscription_entity_1.Subscription);
        const sub = await subRepo.findOne({ where: { id: Number(subscriptionId) } });
        if (!sub) {
            throw new core_1.UserInputError('Subscription not found');
        }
        sub.status = 'cancelled';
        await subRepo.save(sub);
        const occRepo = this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence);
        const pendings = await occRepo.find({
            where: { subscriptionId: Number(subscriptionId), status: 'pending' },
        });
        for (const occ of pendings) {
            occ.status = 'cancelled';
            await occRepo.save(occ);
        }
        return sub;
    }
    async customerSubscriptions(ctx, customerId, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection.getRepository(ctx, subscription_entity_1.Subscription).findAndCount({
            where: { channelId: ctx.channelId, customerId },
            order: { createdAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async occurrencesOf(ctx, subscriptionId, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence).findAndCount({
            where: { channelId: ctx.channelId, subscriptionId: Number(subscriptionId) },
            order: { periodNo: 'ASC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async shopPlans(ctx, options) {
        var _a, _b;
        const shop = await this.requireMyShop(ctx);
        const [items, totalItems] = await this.connection.getRepository(ctx, subscription_plan_entity_1.SubscriptionPlan).findAndCount({
            where: { channelId: ctx.channelId, shopId: shop.id },
            order: { createdAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async allPlans(ctx, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection.getRepository(ctx, subscription_plan_entity_1.SubscriptionPlan).findAndCount({
            where: { channelId: ctx.channelId, enabled: true },
            order: { createdAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    /** 平台视角：全部订阅（按 channel 过滤，不按客户）。 */
    async allSubscriptions(ctx, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection.getRepository(ctx, subscription_entity_1.Subscription).findAndCount({
            where: { channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    /** 平台视角：全部期次（按 channel 过滤，不按客户）。 */
    async allOccurrences(ctx, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection.getRepository(ctx, subscription_occurrence_entity_1.SubscriptionOccurrence).findAndCount({
            where: { channelId: ctx.channelId },
            order: { scheduledDate: 'ASC' },
            skip: (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0,
            take: (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50,
        });
        return { items, totalItems };
    }
    async createPlan(ctx, input) {
        var _a;
        const shop = await this.requireMyShop(ctx);
        // frequency 以 JSON 字符串形式经 GraphQL 传入，这里解析为多频次对象后落库（simple-json）。
        let frequency = input.frequency;
        if (typeof frequency === 'string') {
            try {
                frequency = JSON.parse(frequency);
            }
            catch (_b) {
                throw new core_1.UserInputError('Invalid frequency');
            }
        }
        const plan = new subscription_plan_entity_1.SubscriptionPlan(Object.assign(Object.assign({ channelId: ctx.channelId, shopId: shop.id }, input), { frequency, enabled: (_a = input.enabled) !== null && _a !== void 0 ? _a : true }));
        return this.connection.getRepository(ctx, subscription_plan_entity_1.SubscriptionPlan).save(plan);
    }
    /** JobQueue handler 入口：对给定 channel 扫一次到期期次。 */
    async runDaily(ctx) {
        return this.processDueOccurrences(ctx);
    }
    async requireMyShop(ctx) {
        // 复用 shop-plugin 阶段18 账权语义（Shop.administratorId 归属 + active 校验）。
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
};
exports.SubscriptionService = SubscriptionService;
exports.SubscriptionService = SubscriptionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.SUBSCRIPTION_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.AdministratorService])
], SubscriptionService);
//# sourceMappingURL=subscription.service.js.map