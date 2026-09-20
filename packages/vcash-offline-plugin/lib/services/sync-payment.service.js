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
exports.SyncPaymentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@vendure/core");
const typeorm_2 = require("typeorm");
const constants_1 = require("../constants");
const sync_queue_service_1 = require("./sync-queue.service");
/**
 * 离线 Payment 同步服务：
 * 1. 幂等校验（同 sync-order 逻辑）
 * 2. 按 orderKey 找已同步的 Order（从 OfflineSyncQueue 查 syncedOrderId）
 * 3. 创建 Payment（method, amount, state='Settled'）并关联 Order
 * 4. 成功 markSuccess / 失败 markFailed
 *
 * syncedOrderId 字段在 type='payment' 记录中复用为 paymentId。
 */
let SyncPaymentService = class SyncPaymentService {
    constructor(queueService, connection, transactionalConnection) {
        this.queueService = queueService;
        this.connection = connection;
        this.transactionalConnection = transactionalConnection;
    }
    async syncSinglePayment(ctx, payment) {
        var _a, _b, _c;
        // 1. 幂等校验
        const existing = await this.queueService.findExisting(payment.idempotencyKey);
        if (existing) {
            if (existing.status === constants_1.SYNC_STATUS.SUCCESS) {
                return {
                    idempotencyKey: payment.idempotencyKey,
                    paymentId: (_a = existing.syncedOrderId) !== null && _a !== void 0 ? _a : 0,
                    orderId: 0,
                    status: 'duplicate',
                };
            }
            if (existing.status === constants_1.SYNC_STATUS.FAILED) {
                if (this.queueService.isStaleVersion(new Date(payment.clientUpdatedAt), new Date(existing.clientUpdatedAt))) {
                    return {
                        idempotencyKey: payment.idempotencyKey,
                        error: 'stale version: clientUpdatedAt is older than existing record',
                        code: 'CONFLICT',
                        status: 'failed',
                    };
                }
                await this.queueService.delete(existing.id);
            }
            else {
                return {
                    idempotencyKey: payment.idempotencyKey,
                    paymentId: (_b = existing.syncedOrderId) !== null && _b !== void 0 ? _b : 0,
                    orderId: 0,
                    status: 'duplicate',
                };
            }
        }
        // 2. 创建 pending 记录
        const queueItem = await this.queueService.savePending({
            idempotencyKey: payment.idempotencyKey,
            type: 'payment',
            payload: payment,
            clientCreatedAt: new Date(payment.clientCreatedAt),
            clientUpdatedAt: new Date(payment.clientUpdatedAt),
        });
        // 3. 找已同步的 Order
        try {
            const orderQueue = await this.queueService.findExisting(payment.orderKey);
            if (!orderQueue || orderQueue.type !== 'order' || !orderQueue.syncedOrderId) {
                await this.queueService.markFailed(queueItem.id, {
                    code: 'ORDER_NOT_SYNCED',
                    message: `未找到 orderKey=${payment.orderKey} 对应的已同步订单`,
                });
                return {
                    idempotencyKey: payment.idempotencyKey,
                    error: `未找到 orderKey=${payment.orderKey} 对应的已同步订单`,
                    code: 'ORDER_NOT_SYNCED',
                    status: 'failed',
                };
            }
            const orderId = orderQueue.syncedOrderId;
            // 4. 创建 Payment（state='Settled'）并关联 Order
            const savedPayment = await this.transactionalConnection
                .withTransaction(ctx, async () => {
                var _a;
                const paymentRepo = this.connection.getRepository(core_1.Payment);
                const newPayment = new core_1.Payment();
                newPayment.method = payment.method;
                newPayment.amount = payment.amount;
                newPayment.state = 'Settled';
                newPayment.transactionId = payment.transactionId;
                newPayment.metadata = (_a = payment.metadata) !== null && _a !== void 0 ? _a : {};
                newPayment.order = { id: orderId };
                return paymentRepo.save(newPayment);
            });
            // 5. markSuccess（复用 syncedOrderId 字段存 paymentId）
            await this.queueService.markSuccess(queueItem.id, Number(savedPayment.id), String(orderId));
            return {
                idempotencyKey: payment.idempotencyKey,
                paymentId: Number(savedPayment.id),
                orderId,
                status: 'success',
            };
        }
        catch (e) {
            const code = (_c = e.code) !== null && _c !== void 0 ? _c : 'UNKNOWN';
            await this.queueService.markFailed(queueItem.id, { code, message: e.message });
            return {
                idempotencyKey: payment.idempotencyKey,
                error: e.message,
                code,
                status: 'failed',
            };
        }
    }
};
exports.SyncPaymentService = SyncPaymentService;
exports.SyncPaymentService = SyncPaymentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(sync_queue_service_1.OfflineSyncQueueService)),
    __param(1, (0, typeorm_1.InjectConnection)()),
    __param(2, (0, common_1.Inject)(core_1.TransactionalConnection)),
    __metadata("design:paramtypes", [sync_queue_service_1.OfflineSyncQueueService,
        typeorm_2.Connection,
        core_1.TransactionalConnection])
], SyncPaymentService);
//# sourceMappingURL=sync-payment.service.js.map