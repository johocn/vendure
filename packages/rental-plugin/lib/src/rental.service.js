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
exports.RentalService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const rental_plan_entity_1 = require("./rental-plan.entity");
const rental_schedule_bridge_1 = require("./rental-schedule-bridge");
const RENT_UNITS = ['day', 'week', 'month'];
const PAYMENT_MODES = ['prepaid', 'postpaid'];
let RentalService = class RentalService {
    constructor(connection, listQueryBuilder, orderService, moduleRef, options) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = orderService;
        this.moduleRef = moduleRef;
        this.options = options;
    }
    repo(ctx) {
        return this.connection.getRepository(ctx, rental_plan_entity_1.RentalPlan);
    }
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(rental_plan_entity_1.RentalPlan, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findByVariant(ctx, variantId) {
        return this.repo(ctx)
            .createQueryBuilder('plan')
            .innerJoin('plan.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
            .where('plan.variantId = :vid', { vid: Number(variantId) })
            .andWhere('plan.enabled = :enabled', { enabled: true })
            .getMany();
    }
    async findOne(ctx, id) {
        var _a;
        return (_a = (await this.repo(ctx).findOne({ where: { id: id } }))) !== null && _a !== void 0 ? _a : undefined;
    }
    async create(ctx, input) {
        this.assertValid(input);
        const plan = new rental_plan_entity_1.RentalPlan(input);
        plan.channels = [ctx.channel];
        return this.repo(ctx).save(plan);
    }
    async update(ctx, input) {
        const plan = await this.repo(ctx).findOne({ where: { id: input.id } });
        if (!plan) {
            throw new core_2.UserInputError(`RentalPlan ${input.id} not found`);
        }
        const merged = Object.assign(Object.assign({}, plan), input);
        this.assertValid(merged);
        Object.assign(plan, input);
        return this.repo(ctx).save(plan);
    }
    async delete(ctx, id) {
        await this.repo(ctx).delete(id);
    }
    get defaultGraceHours() {
        var _a;
        return (_a = this.options.defaultGraceHours) !== null && _a !== void 0 ? _a : 72;
    }
    /**
     * 结算页选择租赁：校验归属/状态/含对应商品行 → 生成期次实例（押金 + 租金）。
     * 注：RequestContext 无 injector 属性（本仓 Vendure 3.6 实装），
     * 经注入的 ModuleRef 构造 Injector（同 installment 场景手法）。
     */
    async startRental(ctx, orderId, planId, periods) {
        var _a, _b, _c;
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'customer.user',
            // hasLines 校验需 lines.productVariant（findOne 不默认加载 lines）
            'lines',
            'lines.productVariant',
        ]);
        if (!order) {
            throw new core_2.UserInputError(`Order ${orderId} not found`);
        }
        if (((_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) !== ctx.activeUserId) {
            throw new core_2.UserInputError('You can only start rental on your own order');
        }
        if (order.state !== 'ArrangingPayment') {
            throw new core_2.UserInputError(`Order state ${order.state} does not allow starting a rental`);
        }
        if (!Number.isInteger(periods) || periods < 1 || periods > 36) {
            throw new core_2.UserInputError('periods must be an integer between 1 and 36');
        }
        const plan = await this.findOne(ctx, planId);
        if (!plan || !plan.enabled) {
            throw new core_2.UserInputError(`RentalPlan ${planId} not found or disabled`);
        }
        const hasLines = (_c = order === null || order === void 0 ? void 0 : order.lines) === null || _c === void 0 ? void 0 : _c.some((l) => { var _a; return String((_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.id) === String(plan.variantId); });
        if (!hasLines) {
            throw new core_2.UserInputError('Order does not contain the rental variant');
        }
        await (0, rental_schedule_bridge_1.createRentalSchedule)(ctx, new core_2.Injector(this.moduleRef), order, plan, periods, this.defaultGraceHours);
        return (await this.orderService.findOne(ctx, orderId));
    }
    /**
     * 租期付清后的所有权买断：按下单快照买断价扣除已付租金，追加 buyout 期次（payable，date now）。
     * 买断款随后经 paySchedulePeriod 支付——调度被 addScheduleItem 拉回 in_progress，
     * 订单处于 PaymentSettled 也可付（PAYABLE_SOURCE_STATES 含 PaymentSettled，见 Task 4）。
     */
    async buyoutRental(ctx, orderId) {
        var _a, _b, _c;
        const scheduleService = (0, rental_schedule_bridge_1.tryGetScheduleService)(new core_2.Injector(this.moduleRef));
        if (!scheduleService) {
            throw new core_2.UserInputError('Payment schedule plugin is not available');
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new core_2.UserInputError(`Order ${orderId} not found`);
        }
        if (((_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) !== ctx.activeUserId) {
            throw new core_2.UserInputError('You can only buy out your own rental');
        }
        const withItems = await scheduleService.getScheduleForOrder(ctx, orderId, { requireOwner: true });
        if (!withItems || withItems.schedule.scenario !== 'rental') {
            throw new core_2.UserInputError('Order has no rental schedule');
        }
        if (!['in_progress', 'completed'].includes(withItems.schedule.status)) {
            throw new core_2.UserInputError(`Schedule status ${withItems.schedule.status} does not allow buyout`);
        }
        const rental = ((_c = withItems.schedule.meta) !== null && _c !== void 0 ? _c : {}).rental;
        if (!(rental === null || rental === void 0 ? void 0 : rental.allowBuyout) || (rental === null || rental === void 0 ? void 0 : rental.buyoutPrice) == null) {
            throw new core_2.UserInputError('Buyout is not allowed for this rental');
        }
        const paidRent = withItems.items
            .filter((i) => i.kind === 'rent' && i.status === 'paid')
            .reduce((sum, i) => sum + i.amount, 0);
        const amount = Math.max(0, rental.buyoutPrice - paidRent);
        if (amount <= 0) {
            throw new core_2.UserInputError('Paid rent already covers the buyout price');
        }
        const added = await scheduleService.addScheduleItem(ctx, withItems.schedule.id, {
            kind: 'buyout',
            amount,
            trigger: { type: 'date', at: new Date().toISOString() },
        });
        const buyoutItem = added.items.find((i) => i.kind === 'buyout');
        return { scheduleId: withItems.schedule.id, seq: buyoutItem.seq, amount: buyoutItem.amount };
    }
    /** 参数硬校验（押金/租金必须为正；买断价可为 null 但不可为负） */
    assertValid(plan) {
        if (plan.depositAmount != null && plan.depositAmount <= 0) {
            throw new core_2.UserInputError('depositAmount must be > 0');
        }
        if (plan.rentAmount != null && plan.rentAmount <= 0) {
            throw new core_2.UserInputError('rentAmount must be > 0');
        }
        if (plan.rentUnit != null && !RENT_UNITS.includes(plan.rentUnit)) {
            throw new core_2.UserInputError('rentUnit must be day/week/month');
        }
        if (plan.prepaidOrPostpaid != null && !PAYMENT_MODES.includes(plan.prepaidOrPostpaid)) {
            throw new core_2.UserInputError('prepaidOrPostpaid must be prepaid/postpaid');
        }
        if (plan.buyoutPrice != null && plan.buyoutPrice < 0) {
            throw new core_2.UserInputError('buyoutPrice must be >= 0');
        }
    }
};
exports.RentalService = RentalService;
exports.RentalService = RentalService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(constants_1.RENTAL_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        core_2.ListQueryBuilder,
        core_2.OrderService,
        core_1.ModuleRef, Object])
], RentalService);
