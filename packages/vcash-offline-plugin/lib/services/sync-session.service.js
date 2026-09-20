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
exports.SyncSessionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@vendure/core");
const vcash_pos_plugin_1 = require("@vendure/vcash-pos-plugin");
const typeorm_2 = require("typeorm");
const constants_1 = require("../constants");
const offline_sync_queue_entity_1 = require("../entities/offline-sync-queue.entity");
const sync_queue_service_1 = require("./sync-queue.service");
/**
 * 离线 PosSession 同步服务：
 * 1. 幂等校验
 * 2. 调 PosSessionService.openSession 创建 PosSession（terminalCode + openingFloat）
 * 3. 关联已同步的 Orders（通过 sessionCode 查 OfflineSyncQueue → 更新 Order.customFields.posSessionId）
 * 4. 如果 session.state='closed'：调 closeSession（closingCash）
 * 5. 成功 markSuccess（syncedOrderId 复用存 sessionId，syncedOrderCode 复用存 sessionCode）
 *
 * 关键约束：
 * - PosSessionService.openSession 不允许同一终端同时存在 open session
 * - 离线 sessionCode 是客户端生成的临时标识，用于关联 OfflineSyncQueue 中的 order 记录
 *   服务端 PosSession.code 由 generateSessionCode 自动生成
 * - 关联 Orders 时用 PRAGMA 查找 customFields_posSessionId 实际列名（参考 shift-report.service.ts）
 */
let SyncSessionService = class SyncSessionService {
    constructor(queueService, posSessionService, connection, transactionalConnection) {
        this.queueService = queueService;
        this.posSessionService = posSessionService;
        this.connection = connection;
        this.transactionalConnection = transactionalConnection;
    }
    async syncSingleSession(ctx, session) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        // 1. 幂等校验
        const existing = await this.queueService.findExisting(session.idempotencyKey);
        if (existing) {
            if (existing.status === constants_1.SYNC_STATUS.SUCCESS) {
                return {
                    idempotencyKey: session.idempotencyKey,
                    sessionId: (_a = existing.syncedOrderId) !== null && _a !== void 0 ? _a : 0,
                    sessionCode: (_b = existing.syncedOrderCode) !== null && _b !== void 0 ? _b : '',
                    state: (_d = (_c = existing.payload) === null || _c === void 0 ? void 0 : _c.state) !== null && _d !== void 0 ? _d : 'open',
                    status: 'duplicate',
                };
            }
            if (existing.status === constants_1.SYNC_STATUS.FAILED) {
                if (this.queueService.isStaleVersion(new Date(session.clientUpdatedAt), new Date(existing.clientUpdatedAt))) {
                    return {
                        idempotencyKey: session.idempotencyKey,
                        error: 'stale version: clientUpdatedAt is older than existing record',
                        code: 'CONFLICT',
                        status: 'failed',
                    };
                }
                await this.queueService.delete(existing.id);
            }
            else {
                return {
                    idempotencyKey: session.idempotencyKey,
                    sessionId: (_e = existing.syncedOrderId) !== null && _e !== void 0 ? _e : 0,
                    sessionCode: (_f = existing.syncedOrderCode) !== null && _f !== void 0 ? _f : '',
                    state: (_h = (_g = existing.payload) === null || _g === void 0 ? void 0 : _g.state) !== null && _h !== void 0 ? _h : 'open',
                    status: 'duplicate',
                };
            }
        }
        // 2. 创建 pending 记录
        const queueItem = await this.queueService.savePending({
            idempotencyKey: session.idempotencyKey,
            type: 'session',
            payload: session,
            clientCreatedAt: new Date(session.clientCreatedAt),
            clientUpdatedAt: new Date(session.clientUpdatedAt),
            sessionCode: session.sessionCode,
        });
        try {
            // 3. 开班
            const opened = await this.posSessionService.openSession({
                terminalCode: session.terminalCode,
                operatorId: session.operatorId,
                openingFloat: session.openingFloat,
            });
            // 4. 关联已同步的 Orders（通过 sessionCode 查 OfflineSyncQueue）
            await this.associateOrders(opened.id, session.sessionCode);
            // 5. 如果离线记录 state='closed'，立即关班
            let finalState = 'open';
            if (session.state === 'closed') {
                const closed = await this.posSessionService.closeSession({
                    sessionId: opened.id,
                    closingCash: (_j = session.closingCash) !== null && _j !== void 0 ? _j : 0,
                });
                finalState = closed.state;
            }
            else {
                finalState = opened.state;
            }
            // 6. markSuccess（syncedOrderId 存 sessionId，syncedOrderCode 存 sessionCode）
            await this.queueService.markSuccess(queueItem.id, Number(opened.id), opened.code);
            return {
                idempotencyKey: session.idempotencyKey,
                sessionId: Number(opened.id),
                sessionCode: opened.code,
                state: finalState,
                status: 'success',
            };
        }
        catch (e) {
            const code = (_k = e.code) !== null && _k !== void 0 ? _k : 'UNKNOWN';
            await this.queueService.markFailed(queueItem.id, { code, message: e.message });
            return {
                idempotencyKey: session.idempotencyKey,
                error: e.message,
                code,
                status: 'failed',
            };
        }
    }
    /**
     * 关联已同步的 Orders 到新创建的 PosSession。
     * 通过 OfflineSyncQueue.sessionCode 查找同班次的 order 记录，
     * 取 syncedOrderId 后用 PRAGMA 查找 customFields_posSessionId 列名做 raw SQL 更新。
     */
    async associateOrders(sessionId, offlineSessionCode) {
        var _a;
        const orderQueues = await this.connection.getRepository(offline_sync_queue_entity_1.OfflineSyncQueue).find({
            where: { type: 'order', sessionCode: offlineSessionCode, status: constants_1.SYNC_STATUS.SUCCESS },
        });
        if (orderQueues.length === 0)
            return;
        // PRAGMA 查找 customFields_posSessionId 实际列名
        const columns = (await this.connection.query('PRAGMA table_info("order")'));
        const colName = (_a = columns.find(c => c.name.toLowerCase().replace(/_/g, '').includes('possessionid'))) === null || _a === void 0 ? void 0 : _a.name;
        if (!colName)
            return;
        for (const oq of orderQueues) {
            if (!oq.syncedOrderId)
                continue;
            await this.connection.query(`UPDATE "order" SET "${colName}" = ? WHERE id = ?`, [sessionId, oq.syncedOrderId]);
        }
    }
};
exports.SyncSessionService = SyncSessionService;
exports.SyncSessionService = SyncSessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(sync_queue_service_1.OfflineSyncQueueService)),
    __param(1, (0, common_1.Inject)(vcash_pos_plugin_1.PosSessionService)),
    __param(2, (0, typeorm_1.InjectConnection)()),
    __param(3, (0, common_1.Inject)(core_1.TransactionalConnection)),
    __metadata("design:paramtypes", [sync_queue_service_1.OfflineSyncQueueService,
        vcash_pos_plugin_1.PosSessionService,
        typeorm_2.Connection,
        core_1.TransactionalConnection])
], SyncSessionService);
//# sourceMappingURL=sync-session.service.js.map