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
exports.InstallmentService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const installment_plan_entity_1 = require("./installment-plan.entity");
const INTERVAL_UNITS = ['day', 'week', 'month'];
let InstallmentService = class InstallmentService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
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
            throw new core_1.UserInputError(`InstallmentPlan ${input.id} not found`);
        }
        const merged = Object.assign(Object.assign({}, plan), input);
        this.assertValid(merged);
        Object.assign(plan, input);
        return this.repo(ctx).save(plan);
    }
    async delete(ctx, id) {
        await this.repo(ctx).delete(id);
    }
    /** 参数硬校验（设计 §5：首付比 0-90 / 期数 1-36） */
    assertValid(plan) {
        if (plan.downPaymentRatio != null && (plan.downPaymentRatio < 0 || plan.downPaymentRatio > 90)) {
            throw new core_1.UserInputError('downPaymentRatio must be between 0 and 90');
        }
        if (plan.periods != null && (plan.periods < 1 || plan.periods > 36)) {
            throw new core_1.UserInputError('periods must be between 1 and 36');
        }
        if (plan.intervalUnit != null && !INTERVAL_UNITS.includes(plan.intervalUnit)) {
            throw new core_1.UserInputError('intervalUnit must be day/week/month');
        }
        if (plan.intervalCount != null && plan.intervalCount < 0) {
            throw new core_1.UserInputError('intervalCount must be >= 0');
        }
    }
};
exports.InstallmentService = InstallmentService;
exports.InstallmentService = InstallmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], InstallmentService);
