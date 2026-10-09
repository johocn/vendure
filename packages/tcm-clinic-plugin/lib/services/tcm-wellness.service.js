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
exports.TcmWellnessService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const tcm_follow_up_task_entity_1 = require("../entities/tcm-follow-up-task.entity");
const tcm_plan_item_entity_1 = require("../entities/tcm-plan-item.entity");
const tcm_wellness_plan_entity_1 = require("../entities/tcm-wellness-plan.entity");
const tcm_audit_service_1 = require("./tcm-audit.service");
const PLAN_TRANSITIONS = {
    DRAFT: ['ACTIVE'],
    ACTIVE: ['PAUSED', 'CLOSED'],
    PAUSED: ['ACTIVE', 'CLOSED'],
    CLOSED: [],
};
let TcmWellnessService = class TcmWellnessService {
    constructor(connection, audit) {
        this.connection = connection;
        this.audit = audit;
    }
    async createPlan(ctx, staffId, input) {
        const plan = await this.connection
            .getRepository(ctx, tcm_wellness_plan_entity_1.TcmWellnessPlan)
            .save(new tcm_wellness_plan_entity_1.TcmWellnessPlan(Object.assign(Object.assign({}, input), { status: 'DRAFT' })));
        await this.audit.log(ctx, { entityType: 'TcmWellnessPlan', entityId: Number(plan.id), staffId, action: 'CREATE' });
        return plan;
    }
    async transitionPlan(ctx, staffId, id, to) {
        const repo = this.connection.getRepository(ctx, tcm_wellness_plan_entity_1.TcmWellnessPlan);
        const plan = await repo.findOne({ where: { id } });
        if (!plan) {
            throw new core_1.UserInputError(`康养规划不存在：${id}`);
        }
        if (!PLAN_TRANSITIONS[plan.status].includes(to)) {
            throw new core_1.IllegalOperationError(`非法状态迁移：${plan.status} → ${to}`);
        }
        const saved = await repo.save(Object.assign(Object.assign({}, plan), { status: to }));
        await this.audit.log(ctx, {
            entityType: 'TcmWellnessPlan',
            entityId: id,
            staffId,
            action: 'UPDATE',
            diff: { status: to },
        });
        return saved;
    }
    async addPlanItem(ctx, input) {
        const plan = await this.connection
            .getRepository(ctx, tcm_wellness_plan_entity_1.TcmWellnessPlan)
            .findOne({ where: { id: input.planId } });
        if (!plan || plan.status === 'CLOSED') {
            throw new core_1.UserInputError(`规划不可添加计划项：planId=${input.planId}`);
        }
        return this.connection.getRepository(ctx, tcm_plan_item_entity_1.TcmPlanItem).save(new tcm_plan_item_entity_1.TcmPlanItem(input));
    }
    async createFollowUp(ctx, staffId, input) {
        var _a;
        const task = await this.connection.getRepository(ctx, tcm_follow_up_task_entity_1.TcmFollowUpTask).save(new tcm_follow_up_task_entity_1.TcmFollowUpTask(Object.assign(Object.assign({}, input), { channel: (_a = input.channel) !== null && _a !== void 0 ? _a : 'wechat', status: 'PENDING' })));
        await this.audit.log(ctx, { entityType: 'TcmFollowUpTask', entityId: Number(task.id), staffId, action: 'CREATE' });
        return task;
    }
    async completeFollowUp(ctx, staffId, id, followUpEncounterId) {
        const repo = this.connection.getRepository(ctx, tcm_follow_up_task_entity_1.TcmFollowUpTask);
        const task = await repo.findOne({ where: { id } });
        if (!task || task.status !== 'PENDING') {
            throw new core_1.UserInputError(`随访任务不可完成：id=${id}`);
        }
        const saved = await repo.save(Object.assign(Object.assign({}, task), { status: 'DONE', followUpEncounterId }));
        await this.audit.log(ctx, {
            entityType: 'TcmFollowUpTask',
            entityId: id,
            staffId,
            action: 'UPDATE',
            diff: { status: 'DONE' },
        });
        return saved;
    }
    async cancelFollowUp(ctx, staffId, id) {
        const repo = this.connection.getRepository(ctx, tcm_follow_up_task_entity_1.TcmFollowUpTask);
        const task = await repo.findOne({ where: { id } });
        if (!task || task.status !== 'PENDING') {
            throw new core_1.UserInputError(`随访任务不可取消：id=${id}`);
        }
        const saved = await repo.save(Object.assign(Object.assign({}, task), { status: 'CANCELED' }));
        await this.audit.log(ctx, {
            entityType: 'TcmFollowUpTask',
            entityId: id,
            staffId,
            action: 'UPDATE',
            diff: { status: 'CANCELED' },
        });
        return saved;
    }
    async itemsOfPlan(ctx, planId) {
        return this.connection.getRepository(ctx, tcm_plan_item_entity_1.TcmPlanItem).find({ where: { planId }, order: { id: 'ASC' } });
    }
};
exports.TcmWellnessService = TcmWellnessService;
exports.TcmWellnessService = TcmWellnessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, tcm_audit_service_1.TcmAuditService])
], TcmWellnessService);
//# sourceMappingURL=tcm-wellness.service.js.map