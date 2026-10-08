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
exports.RentalService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const rental_plan_entity_1 = require("./rental-plan.entity");
const RENT_UNITS = ['day', 'week', 'month'];
const PAYMENT_MODES = ['prepaid', 'postpaid'];
let RentalService = class RentalService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
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
            throw new core_1.UserInputError(`RentalPlan ${input.id} not found`);
        }
        const merged = Object.assign(Object.assign({}, plan), input);
        this.assertValid(merged);
        Object.assign(plan, input);
        return this.repo(ctx).save(plan);
    }
    async delete(ctx, id) {
        await this.repo(ctx).delete(id);
    }
    /** 参数硬校验（押金/租金必须为正；买断价可为 null 但不可为负） */
    assertValid(plan) {
        if (plan.depositAmount != null && plan.depositAmount <= 0) {
            throw new core_1.UserInputError('depositAmount must be > 0');
        }
        if (plan.rentAmount != null && plan.rentAmount <= 0) {
            throw new core_1.UserInputError('rentAmount must be > 0');
        }
        if (plan.rentUnit != null && !RENT_UNITS.includes(plan.rentUnit)) {
            throw new core_1.UserInputError('rentUnit must be day/week/month');
        }
        if (plan.prepaidOrPostpaid != null && !PAYMENT_MODES.includes(plan.prepaidOrPostpaid)) {
            throw new core_1.UserInputError('prepaidOrPostpaid must be prepaid/postpaid');
        }
        if (plan.buyoutPrice != null && plan.buyoutPrice < 0) {
            throw new core_1.UserInputError('buyoutPrice must be >= 0');
        }
    }
};
exports.RentalService = RentalService;
exports.RentalService = RentalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], RentalService);
