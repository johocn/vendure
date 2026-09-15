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
exports.ReconciliationService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const reconciliation_entity_1 = require("./reconciliation.entity");
const diff_rules_1 = require("./diff-rules");
const loggerCtx = 'ReconciliationService';
let ReconciliationService = class ReconciliationService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 幂等跑批：同日已有 done 批次则返回 null */
    async runBatch(ctx, date, trigger) {
        var _a, _b, _c;
        const batchRepo = this.connection.getRepository(ctx, reconciliation_entity_1.ReconciliationBatch);
        const existing = await batchRepo.findOne({
            where: { tenantChannelId: ctx.channelId, date },
        });
        if ((existing === null || existing === void 0 ? void 0 : existing.status) === 'done') {
            return null;
        }
        const batch = existing !== null && existing !== void 0 ? existing : (await batchRepo.save(new reconciliation_entity_1.ReconciliationBatch({
            tenantChannelId: ctx.channelId,
            date,
            status: 'running',
            trigger,
            startedAt: new Date(),
        })));
        const orderRepo = this.connection.getRepository(ctx, 'Order');
        // 当前租户渠道下订单（Order 通过 channels 多对多归属渠道）；取前 500 单
        const orders = await orderRepo.find({
            where: { channels: { id: ctx.channelId } },
            relations: { lines: true },
            take: 500,
        });
        const lineRepo = this.connection.getRepository(ctx, reconciliation_entity_1.ReconciliationOrderLine);
        let d1 = 0, d2 = 0, d3 = 0, d4 = 0;
        for (const order of orders) {
            const data = await this.collectOrderData(ctx, order);
            const diffs = (0, diff_rules_1.diffOrder)({
                order: {
                    id: String(order.id),
                    totalWithTax: (_a = order.totalWithTax) !== null && _a !== void 0 ? _a : 0,
                    state: (_b = order.state) !== null && _b !== void 0 ? _b : '',
                    customFields: (_c = order.customFields) !== null && _c !== void 0 ? _c : {},
                },
                deliveryRecords: data.deliveryRecords,
                ledgerOuts: data.ledgerOuts,
                settlements: data.settlements,
                mirrorDiff: data.mirrorDiff,
                cancelled: order.state === 'Cancelled',
            });
            if (diffs.length) {
                await lineRepo.save(new reconciliation_entity_1.ReconciliationOrderLine({
                    batchId: batch.id,
                    orderId: order.id,
                    diffTypes: JSON.stringify(diffs),
                    status: 'pending',
                }));
                d1 += diffs.includes('D1') ? 1 : 0;
                d2 += diffs.includes('D2') ? 1 : 0;
                d3 += diffs.includes('D3') ? 1 : 0;
                d4 += diffs.includes('D4') ? 1 : 0;
            }
        }
        batch.status = 'done';
        batch.d1Count = d1;
        batch.d2Count = d2;
        batch.d3Count = d3;
        batch.d4Count = d4;
        batch.orderTotal = orders.length;
        batch.finishedAt = new Date();
        await batchRepo.save(batch);
        core_1.Logger.info(`对账批次完成: ${date} 订单=${orders.length} D1=${d1} D2=${d2} D3=${d3} D4=${d4}`, loggerCtx);
        return batch;
    }
    /** 采集一单四流数据（数据源：Order / OrderStockLedger / DeliveryRecord / MerchantSettlementLedger） */
    async collectOrderData(ctx, order) {
        var _a;
        const lineIds = ((_a = order.lines) !== null && _a !== void 0 ? _a : []).map((l) => l.id);
        const outs = [];
        const mirrors = [];
        if (lineIds.length) {
            const ledgerRepo = this.connection.getRepository(ctx, 'OrderStockLedger');
            const ledgers = await ledgerRepo.find({ where: { orderLineId: (0, typeorm_1.In)(lineIds) } });
            outs.push(...ledgers.filter((l) => l.bizType === 'order' && l.direction === 'out'));
            mirrors.push(...ledgers.filter((l) => l.bizType === 'mirror'));
        }
        const deliveryRepo = this.connection.getRepository(ctx, 'DeliveryRecord');
        const records = await deliveryRepo.find({ where: { orderId: order.id } });
        const settleRepo = this.connection.getRepository(ctx, 'MerchantSettlementLedger');
        const settlements = await settleRepo.find({ where: { orderId: order.id } });
        return {
            deliveryRecords: records.map((r) => ({ mode: r.mode, sourceLocationId: r.sourceLocationId, status: r.status })),
            ledgerOuts: outs.map((l) => ({ sourceLocationId: l.stockLocationId, quantity: l.quantity })),
            settlements: settlements.map((s) => ({ status: s.status, amount: s.amount })),
            mirrorDiff: mirrors.reduce((sum, m) => sum + (m.direction === 'in' ? m.quantity : -m.quantity), 0),
        };
    }
    /** 重跑单条：重新判定后置 closed */
    async rerunOrder(ctx, lineId) {
        var _a, _b, _c;
        const lineRepo = this.connection.getRepository(ctx, reconciliation_entity_1.ReconciliationOrderLine);
        const line = await lineRepo.findOne({ where: { id: lineId } });
        if (!line) {
            throw new Error(`对账行不存在: ${lineId}`);
        }
        const orderRepo = this.connection.getRepository(ctx, 'Order');
        const order = await orderRepo.findOne({
            where: { id: line.orderId },
            relations: { lines: true },
        });
        if (!order) {
            throw new Error(`订单不存在: ${line.orderId}`);
        }
        const data = await this.collectOrderData(ctx, order);
        const diffs = (0, diff_rules_1.diffOrder)({
            order: {
                id: String(order.id),
                totalWithTax: (_a = order.totalWithTax) !== null && _a !== void 0 ? _a : 0,
                state: (_b = order.state) !== null && _b !== void 0 ? _b : '',
                customFields: (_c = order.customFields) !== null && _c !== void 0 ? _c : {},
            },
            deliveryRecords: data.deliveryRecords,
            ledgerOuts: data.ledgerOuts,
            settlements: data.settlements,
            mirrorDiff: data.mirrorDiff,
            cancelled: order.state === 'Cancelled',
        });
        line.diffTypes = JSON.stringify(diffs);
        line.status = diffs.length ? 'pending' : 'closed';
        if (!diffs.length) {
            line.fixedAt = new Date();
        }
        return lineRepo.save(line);
    }
    async listBatches(ctx) {
        return this.connection.getRepository(ctx, reconciliation_entity_1.ReconciliationBatch).find({
            where: { tenantChannelId: ctx.channelId },
            order: { createdAt: 'DESC' },
            take: 60,
        });
    }
    async listLines(ctx, batchId) {
        return this.connection.getRepository(ctx, reconciliation_entity_1.ReconciliationOrderLine).find({
            where: { batchId: batchId },
            order: { createdAt: 'ASC' },
        });
    }
};
exports.ReconciliationService = ReconciliationService;
exports.ReconciliationService = ReconciliationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], ReconciliationService);
//# sourceMappingURL=reconciliation.service.js.map