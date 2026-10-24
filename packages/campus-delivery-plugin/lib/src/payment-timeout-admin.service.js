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
exports.PaymentTimeoutAdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const payment_timeout_job_1 = require("./payment-timeout.job");
const payment_timeout_entity_1 = require("./payment-timeout.entity");
let PaymentTimeoutAdminService = class PaymentTimeoutAdminService {
    constructor(connection, job) {
        this.connection = connection;
        this.job = job;
        this.taskRepo = this.connection.rawConnection.getRepository(payment_timeout_entity_1.PaymentTimeoutTask);
        this.orderRepo = this.connection.rawConnection.getRepository(core_1.Order);
    }
    isPlatformAdmin(ctx) {
        return ctx.userHasPermissions([core_1.Permission.SuperAdmin]);
    }
    /** 非平台超管只能操作本渠道任务，避免误读/误取消其他店铺待付款单 */
    async assertTaskScope(ctx, id) {
        if (this.isPlatformAdmin(ctx))
            return;
        const task = await this.taskRepo.findOne({ where: { id } });
        if (!task || Number(task.channelId) !== Number(ctx.channelId)) {
            throw new core_1.UserInputError('任务不属于当前店铺');
        }
    }
    /** 任务分页列表（dueAt 倒序），附带订单号/订单状态摘要 */
    async listTasks(ctx, opts) {
        var _a, _b, _c, _d;
        const take = Math.min((_a = opts.take) !== null && _a !== void 0 ? _a : 20, 100);
        const where = {};
        if (opts.status)
            where.status = opts.status;
        if (opts.type)
            where.type = opts.type;
        if (opts.from || opts.to)
            where.dueAt = (0, typeorm_1.Between)((_b = opts.from) !== null && _b !== void 0 ? _b : new Date(0), (_c = opts.to) !== null && _c !== void 0 ? _c : new Date('2999-12-31'));
        if (!this.isPlatformAdmin(ctx))
            where.channelId = Number(ctx.channelId);
        const [tasks, total] = await this.taskRepo.findAndCount({
            where: where,
            order: { dueAt: 'DESC' },
            skip: (_d = opts.skip) !== null && _d !== void 0 ? _d : 0,
            take,
        });
        const ids = [...new Set(tasks.map(t => Number(t.orderId)))];
        const orders = ids.length ? await this.orderRepo.find({ where: { id: (0, typeorm_1.In)(ids) } }) : [];
        const byId = new Map(orders.map((o) => [Number(o.id), o]));
        const items = tasks.map(t => {
            var _a, _b, _c, _d;
            return (Object.assign(Object.assign({}, t), { orderCode: (_b = (_a = byId.get(Number(t.orderId))) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : null, orderState: (_d = (_c = byId.get(Number(t.orderId))) === null || _c === void 0 ? void 0 : _c.state) !== null && _d !== void 0 ? _d : null }));
        });
        return { items, total };
    }
    /** 看板统计：今日已提醒 / 今日已取消 / 累计失败 / 逾期未处理（非超管限本渠道） */
    async getStats(ctx) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const scope = this.isPlatformAdmin(ctx) ? {} : { channelId: Number(ctx.channelId) };
        const [todayRemind, todayCancel, totalFailed, pendingOverdue] = await Promise.all([
            this.taskRepo.count({ where: Object.assign(Object.assign({}, scope), { type: payment_timeout_entity_1.PaymentTimeoutType.REMIND, status: payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED, dueAt: (0, typeorm_1.Between)(startOfDay, new Date()) }) }),
            this.taskRepo.count({ where: Object.assign(Object.assign({}, scope), { type: payment_timeout_entity_1.PaymentTimeoutType.CANCEL, status: payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED, dueAt: (0, typeorm_1.Between)(startOfDay, new Date()) }) }),
            this.taskRepo.count({ where: Object.assign(Object.assign({}, scope), { status: payment_timeout_entity_1.PaymentTimeoutStatus.FAILED }) }),
            this.taskRepo.count({ where: Object.assign(Object.assign({}, scope), { status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING, dueAt: (0, typeorm_1.LessThan)(new Date()) }) }),
        ]);
        return { todayRemind, todayCancel, totalFailed, pendingOverdue };
    }
    async executeTask(ctx, id) {
        await this.assertTaskScope(ctx, id);
        return this.job.executeTaskNow(id);
    }
    async resendRemind(ctx, taskId) {
        await this.assertTaskScope(ctx, taskId);
        return this.job.resendRemind(taskId);
    }
    runCompensationNow() {
        return this.job.runCompensation();
    }
};
exports.PaymentTimeoutAdminService = PaymentTimeoutAdminService;
exports.PaymentTimeoutAdminService = PaymentTimeoutAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        payment_timeout_job_1.PaymentTimeoutJob])
], PaymentTimeoutAdminService);
//# sourceMappingURL=payment-timeout-admin.service.js.map