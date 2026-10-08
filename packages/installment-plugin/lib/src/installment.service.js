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
exports.InstallmentService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const installment_plan_entity_1 = require("./installment-plan.entity");
const installment_schedule_bridge_1 = require("./installment-schedule-bridge");
const INTERVAL_UNITS = ['day', 'week', 'month'];
let InstallmentService = class InstallmentService {
    constructor(connection, listQueryBuilder, orderService, moduleRef, options) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = orderService;
        this.moduleRef = moduleRef;
        this.options = options;
    }
    repo(ctx) {
        return this.connection.getRepository(ctx, installment_plan_entity_1.InstallmentPlan);
    }
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(installment_plan_entity_1.InstallmentPlan, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
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
        const plan = new installment_plan_entity_1.InstallmentPlan(input);
        plan.channels = [ctx.channel];
        return this.repo(ctx).save(plan);
    }
    async update(ctx, input) {
        const plan = await this.repo(ctx).findOne({ where: { id: input.id } });
        if (!plan) {
            throw new core_2.UserInputError(`InstallmentPlan ${input.id} not found`);
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
     * 结算页启用分期：校验归属/状态/无既有期次 → 生成期次实例。
     * 注：RequestContext 无 injector 属性（本仓 Vendure 3.6 实装），
     * 经注入的 ModuleRef 构造 Injector（同 PaymentSchedulePlugin.onApplicationBootstrap 手法）。
     */
    async enableInstallment(ctx, orderId, planId) {
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
            throw new core_2.UserInputError('You can only enable installment on your own order');
        }
        if (order.state !== 'ArrangingPayment') {
            throw new core_2.UserInputError(`Order state ${order.state} does not allow enabling installment`);
        }
        const plan = await this.findOne(ctx, planId);
        if (!plan || !plan.enabled) {
            throw new core_2.UserInputError(`InstallmentPlan ${planId} not found or disabled`);
        }
        const hasLines = (_c = order === null || order === void 0 ? void 0 : order.lines) === null || _c === void 0 ? void 0 : _c.some((l) => { var _a; return String((_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.id) === String(plan.variantId); });
        if (!hasLines) {
            throw new core_2.UserInputError('Order does not contain the installment variant');
        }
        await (0, installment_schedule_bridge_1.createInstallmentSchedule)(ctx, new core_2.Injector(this.moduleRef), order, plan, this.defaultGraceHours);
        return (await this.orderService.findOne(ctx, orderId));
    }
    /** 参数硬校验（设计 §5：首付比 0-90 / 期数 1-36） */
    assertValid(plan) {
        if (plan.downPaymentRatio != null && (plan.downPaymentRatio < 0 || plan.downPaymentRatio > 90)) {
            throw new core_2.UserInputError('downPaymentRatio must be between 0 and 90');
        }
        if (plan.periods != null && (plan.periods < 1 || plan.periods > 36)) {
            throw new core_2.UserInputError('periods must be between 1 and 36');
        }
        if (plan.intervalUnit != null && !INTERVAL_UNITS.includes(plan.intervalUnit)) {
            throw new core_2.UserInputError('intervalUnit must be day/week/month');
        }
        if (plan.intervalCount != null && plan.intervalCount < 0) {
            throw new core_2.UserInputError('intervalCount must be >= 0');
        }
    }
};
exports.InstallmentService = InstallmentService;
exports.InstallmentService = InstallmentService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(constants_1.INSTALLMENT_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        core_2.ListQueryBuilder,
        core_2.OrderService,
        core_1.ModuleRef, Object])
], InstallmentService);
