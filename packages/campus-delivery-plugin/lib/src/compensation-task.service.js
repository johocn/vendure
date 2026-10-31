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
var CompensationTaskService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationTaskService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const compensation_task_entity_1 = require("./compensation-task.entity");
/** R2 补偿任务入队/认领/收敛：只做持久化，执行逻辑在 CompensationRetryJob。
 * 入队失败只记日志（补偿是旁路能力，绝不反向影响主流程）。 */
let CompensationTaskService = CompensationTaskService_1 = class CompensationTaskService {
    constructor(connection, requestContextService) {
        this.connection = connection;
        this.requestContextService = requestContextService;
    }
    async platformCtx() {
        return this.requestContextService.create({ apiType: 'admin' });
    }
    /** 补偿券发放失败入队；同单同模板只保留一条（ON CONFLICT 幂等） */
    async enqueueCoupon(input) {
        await this.enqueue({
            orderId: input.orderId,
            channelId: input.channelId,
            customerId: input.customerId,
            kind: 'coupon',
            payload: { templateId: input.templateId, orderCode: input.orderCode },
            dedupeKey: `coupon:${input.orderCode}:${input.templateId}`,
        });
    }
    /** 站内信写入失败入队；同单同事件（含后缀）只保留一条 */
    async enqueueNotify(input) {
        var _a;
        await this.enqueue({
            orderId: input.orderId,
            channelId: input.channelId,
            customerId: (_a = input.customerId) !== null && _a !== void 0 ? _a : null,
            kind: 'notify',
            payload: { event: input.event, text: input.text, orderCode: input.orderCode },
            dedupeKey: `notify:${input.orderId}:${input.event}${input.suffix ? `:${input.suffix}` : ''}`,
        });
    }
    async enqueue(input) {
        var _a, _b, _c;
        try {
            await this.connection.rawConnection.query('INSERT INTO campus_compensation_task '
                + '("orderId","channelId","customerId",kind,payload,"dedupeKey",status,attempts,"nextAttemptAt") '
                + "VALUES ($1,$2,$3,$4,$5,$6,'pending',0,$7) ON CONFLICT (\"dedupeKey\") DO NOTHING", [
                input.orderId,
                input.channelId,
                (_a = input.customerId) !== null && _a !== void 0 ? _a : null,
                input.kind,
                JSON.stringify((_b = input.payload) !== null && _b !== void 0 ? _b : {}),
                input.dedupeKey,
                new Date(),
            ]);
        }
        catch (e) {
            common_1.Logger.error(`补偿任务入队失败（${input.dedupeKey}）：${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, 'CampusCompensation');
        }
    }
    /** 管理端任务列表（按 createdAt 倒序）；status 为空返回全部 */
    async list(status, skip, take) {
        const pc = await this.platformCtx();
        const where = {};
        if (status) {
            if (!CompensationTaskService_1.STATUSES.includes(status))
                throw new core_1.UserInputError('补偿任务状态不合法');
            where.status = status;
        }
        const [items, total] = await this.connection.getRepository(pc, compensation_task_entity_1.CampusCompensationTask).findAndCount({
            where: where,
            order: { createdAt: 'DESC' },
            skip: Math.max(0, Number(skip) || 0),
            take: Math.min(200, Math.max(1, Number(take) || 20)),
        });
        return { items, total };
    }
    /** 管理端手动重试：failed/pending 重置为立即可执行；返回是否命中（done 任务不重置） */
    async retry(id) {
        const res = await this.connection.rawConnection.query('UPDATE campus_compensation_task SET status = $1, attempts = 0, "nextAttemptAt" = now(), '
            + '"lastError" = NULL, "updatedAt" = now() '
            + "WHERE id = $2 AND status IN ('failed', 'pending') RETURNING id", ['pending', id]);
        const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
        return Array.isArray(rows) && rows.length > 0;
    }
    /** 到期待处理任务（按 nextAttemptAt 升序，最多 limit 条） */
    async due(limit = 20) {
        const pc = await this.platformCtx();
        const now = new Date();
        return this.connection.getRepository(pc, compensation_task_entity_1.CampusCompensationTask).find({
            where: { status: 'pending', nextAttemptAt: (0, typeorm_1.LessThanOrEqual)(now) },
            order: { nextAttemptAt: 'ASC' },
            take: limit,
        });
    }
    /** 条件认领：仅当状态仍为 pending 且 attempts 未变时成功（多实例/并发安全） */
    async claim(id, attempts) {
        const res = await this.connection.rawConnection.query('UPDATE campus_compensation_task SET attempts = attempts + 1, "updatedAt" = now() '
            + "WHERE id = $1 AND status = 'pending' AND attempts = $2 RETURNING id", [id, attempts]);
        const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
        return Array.isArray(rows) && rows.length > 0;
    }
    async markDone(id) {
        await this.connection.rawConnection.query("UPDATE campus_compensation_task SET status = 'done', \"lastError\" = NULL, "
            + '"nextAttemptAt" = NULL, "updatedAt" = now() WHERE id = $1', [id]);
    }
    /** 未耗尽：回 pending 并排下次时间；耗尽：置 failed（由调用方发一次告警） */
    async markFailed(id, exhausted, error, nextAttemptAt) {
        await this.connection.rawConnection.query('UPDATE campus_compensation_task SET status = $1, "lastError" = $2, "nextAttemptAt" = $3, '
            + '"updatedAt" = now() WHERE id = $4', [exhausted ? 'failed' : 'pending', error.slice(0, 255), exhausted ? null : nextAttemptAt, id]);
    }
};
exports.CompensationTaskService = CompensationTaskService;
CompensationTaskService.STATUSES = ['pending', 'done', 'failed'];
exports.CompensationTaskService = CompensationTaskService = CompensationTaskService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.RequestContextService])
], CompensationTaskService);
//# sourceMappingURL=compensation-task.service.js.map