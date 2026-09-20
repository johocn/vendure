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
exports.SyncOrderService = void 0;
const common_1 = require("@nestjs/common");
const vcash_pos_plugin_1 = require("@vendure/vcash-pos-plugin");
const constants_1 = require("../constants");
const sync_queue_service_1 = require("./sync-queue.service");
/**
 * 离线订单同步服务：
 * 1. 幂等校验：success → duplicate；failed + LWW → 重试；failed + stale → CONFLICT
 * 2. 创建 pending 队列记录
 * 3. 调用 PosOrderService.createOrderFromOffline 落库
 * 4. 成功 markSuccess / 失败 markFailed
 */
let SyncOrderService = class SyncOrderService {
    constructor(queueService, posOrderService) {
        this.queueService = queueService;
        this.posOrderService = posOrderService;
    }
    async syncSingleOrder(ctx, order) {
        var _a, _b, _c, _d;
        // 1. 幂等校验
        const existing = await this.queueService.findExisting(order.idempotencyKey);
        if (existing) {
            if (existing.status === constants_1.SYNC_STATUS.SUCCESS) {
                return {
                    idempotencyKey: order.idempotencyKey,
                    orderId: existing.syncedOrderId,
                    orderCode: existing.syncedOrderCode,
                    status: 'duplicate',
                };
            }
            if (existing.status === constants_1.SYNC_STATUS.FAILED) {
                // LWW：新 clientUpdatedAt 更旧 → CONFLICT；更新 → 删除旧记录重试
                if (this.queueService.isStaleVersion(new Date(order.clientUpdatedAt), new Date(existing.clientUpdatedAt))) {
                    return {
                        idempotencyKey: order.idempotencyKey,
                        error: 'stale version: clientUpdatedAt is older than existing record',
                        code: 'CONFLICT',
                        status: 'failed',
                    };
                }
                await this.queueService.delete(existing.id);
            }
            else {
                // pending / syncing / cancelled / needs_manual → 不允许重复处理
                return {
                    idempotencyKey: order.idempotencyKey,
                    orderId: (_a = existing.syncedOrderId) !== null && _a !== void 0 ? _a : 0,
                    orderCode: (_b = existing.syncedOrderCode) !== null && _b !== void 0 ? _b : '',
                    status: 'duplicate',
                };
            }
        }
        // 2. 创建 pending 记录
        const queueItem = await this.queueService.savePending({
            idempotencyKey: order.idempotencyKey,
            type: 'order',
            payload: order,
            clientCreatedAt: new Date(order.clientCreatedAt),
            clientUpdatedAt: new Date(order.clientUpdatedAt),
            sessionCode: order.sessionCode,
        });
        // 3. 调用 PosOrderService 落库
        try {
            const newOrder = await this.posOrderService.createOrderFromOffline(ctx, order);
            await this.queueService.markSuccess(queueItem.id, Number(newOrder.id), newOrder.code);
            return {
                idempotencyKey: order.idempotencyKey,
                orderId: Number(newOrder.id),
                orderCode: newOrder.code,
                status: 'success',
            };
        }
        catch (e) {
            const code = (_c = e.code) !== null && _c !== void 0 ? _c : (((_d = e.message) === null || _d === void 0 ? void 0 : _d.includes('Insufficient stock')) ? 'OUT_OF_STOCK' : 'UNKNOWN');
            await this.queueService.markFailed(queueItem.id, { code, message: e.message });
            return {
                idempotencyKey: order.idempotencyKey,
                error: e.message,
                code,
                status: 'failed',
            };
        }
    }
};
exports.SyncOrderService = SyncOrderService;
exports.SyncOrderService = SyncOrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(sync_queue_service_1.OfflineSyncQueueService)),
    __param(1, (0, common_1.Inject)(vcash_pos_plugin_1.PosOrderService)),
    __metadata("design:paramtypes", [sync_queue_service_1.OfflineSyncQueueService,
        vcash_pos_plugin_1.PosOrderService])
], SyncOrderService);
//# sourceMappingURL=sync-order.service.js.map