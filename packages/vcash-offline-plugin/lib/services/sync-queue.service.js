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
exports.OfflineSyncQueueService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const constants_1 = require("../constants");
const offline_sync_queue_entity_1 = require("../entities/offline-sync-queue.entity");
/**
 * 离线同步队列服务：幂等校验 + LWW + 状态机。
 * - findExisting: 按 idempotencyKey 查已有记录
 * - savePending: 新建 pending 记录
 * - markSuccess/markFailed/markNeedsManual: 状态流转
 * - isStaleVersion: LWW 比较（新 clientUpdatedAt 更旧则返回 true）
 */
let OfflineSyncQueueService = class OfflineSyncQueueService {
    constructor(connection) {
        this.connection = connection;
    }
    async findExisting(idempotencyKey) {
        return this.connection.getRepository(offline_sync_queue_entity_1.OfflineSyncQueue).findOne({
            where: { idempotencyKey },
        });
    }
    async savePending(record) {
        const item = new offline_sync_queue_entity_1.OfflineSyncQueue();
        item.idempotencyKey = record.idempotencyKey;
        item.type = record.type;
        item.payload = record.payload;
        item.clientCreatedAt = record.clientCreatedAt;
        item.clientUpdatedAt = record.clientUpdatedAt;
        item.status = constants_1.SYNC_STATUS.PENDING;
        item.retryCount = 0;
        item.sessionCode = record.sessionCode;
        return this.connection.getRepository(offline_sync_queue_entity_1.OfflineSyncQueue).save(item);
    }
    async markSuccess(id, syncedOrderId, syncedOrderCode) {
        await this.connection.getRepository(offline_sync_queue_entity_1.OfflineSyncQueue).update(id, {
            status: constants_1.SYNC_STATUS.SUCCESS,
            syncedOrderId,
            syncedOrderCode,
            syncedAt: new Date(),
        });
    }
    async markFailed(id, error) {
        var _a;
        const existing = await this.connection
            .getRepository(offline_sync_queue_entity_1.OfflineSyncQueue)
            .findOne({ where: { id } });
        const retryCount = ((_a = existing === null || existing === void 0 ? void 0 : existing.retryCount) !== null && _a !== void 0 ? _a : 0) + 1;
        const status = retryCount > 5 ? constants_1.SYNC_STATUS.NEEDS_MANUAL : constants_1.SYNC_STATUS.FAILED;
        await this.connection.getRepository(offline_sync_queue_entity_1.OfflineSyncQueue).update(id, {
            status,
            syncError: error,
            retryCount,
        });
    }
    async markNeedsManual(id) {
        await this.connection.getRepository(offline_sync_queue_entity_1.OfflineSyncQueue).update(id, {
            status: constants_1.SYNC_STATUS.NEEDS_MANUAL,
        });
    }
    /**
     * LWW 比较：新 clientUpdatedAt 更旧（更早）则返回 true（stale）。
     * 相同时间戳不算 stale（允许重试）。
     */
    isStaleVersion(clientUpdatedAt, existingClientUpdatedAt) {
        return new Date(clientUpdatedAt).getTime() < new Date(existingClientUpdatedAt).getTime();
    }
    async delete(id) {
        await this.connection.getRepository(offline_sync_queue_entity_1.OfflineSyncQueue).delete(id);
    }
};
exports.OfflineSyncQueueService = OfflineSyncQueueService;
exports.OfflineSyncQueueService = OfflineSyncQueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], OfflineSyncQueueService);
//# sourceMappingURL=sync-queue.service.js.map