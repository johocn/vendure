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
exports.CommissionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const commission_record_entity_1 = require("./commission-record.entity");
const distributor_entity_1 = require("./distributor.entity");
const distribution_service_1 = require("./distribution.service");
const constants_1 = require("./constants");
let CommissionService = class CommissionService {
    constructor(connection, listQueryBuilder, distributionService, eventBus) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.distributionService = distributionService;
        this.eventBus = eventBus;
        this.initialized = false;
    }
    init() {
        if (this.initialized)
            return;
        this.initialized = true;
        this.eventBus.ofType(core_1.PaymentStateTransitionEvent).subscribe(async (event) => {
            if (event.toState === 'Settled') {
                try {
                    await this.calculateCommission(event);
                }
                catch (e) {
                    core_1.Logger.error(`Failed to calculate commission for order ${event.order.id}: ${e.message}`, constants_1.loggerCtx);
                }
            }
        });
        this.eventBus.ofType(core_1.RefundStateTransitionEvent).subscribe(async (event) => {
            if (event.toState === 'Settled') {
                try {
                    await this.cancelCommissionByOrder(event.ctx, String(event.order.id));
                }
                catch (e) {
                    core_1.Logger.error(`Failed to cancel commission for order ${event.order.id} on refund: ${e.message}`, constants_1.loggerCtx);
                }
            }
        });
    }
    async calculateCommission(event) {
        var _a, _b, _c, _d, _e, _f;
        const ctx = event.ctx;
        const order = event.order;
        if (!((_a = ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.distributionEnabled)) {
            return;
        }
        const customer = order.customer;
        if (!customer)
            return;
        // 修复：读取 referredBy（推荐人的推荐码），而非 referralCode（自己的码）
        const referredBy = (_b = customer.customFields) === null || _b === void 0 ? void 0 : _b.referredBy;
        if (!referredBy)
            return;
        const directDistributor = await this.distributionService.findByReferralCode(ctx, referredBy);
        if (!directDistributor || directDistributor.status !== 'active')
            return;
        // self-referral 校验：订单用户不能是分销商自己
        if (String(directDistributor.customerId) === String(customer.id)) {
            core_1.Logger.info(`Skip self-referral commission for customer ${customer.id}`, constants_1.loggerCtx);
            return;
        }
        const directRate = (_d = (_c = ctx.channel.customFields) === null || _c === void 0 ? void 0 : _c.directCommissionRate) !== null && _d !== void 0 ? _d : 1000;
        const orderTotal = order.total;
        const directAmount = Math.floor(orderTotal * directRate / 10000);
        // 事务包装：保证多条 CommissionRecord 原子写入
        await this.connection.startTransaction(ctx);
        try {
            const channel = await this.connection.getEntityOrThrow(ctx, core_1.Channel, ctx.channelId);
            const directRecord = new commission_record_entity_1.CommissionRecord({
                distributorId: String(directDistributor.id),
                orderId: String(order.id),
                commissionType: 'direct',
                commissionRate: directRate,
                orderAmount: orderTotal,
                commissionAmount: directAmount,
                status: 'pending',
                settledAt: null,
            });
            directRecord.channels = [channel];
            await this.connection.getRepository(ctx, commission_record_entity_1.CommissionRecord).save(directRecord);
            core_1.Logger.info(`Created direct commission ${directAmount} for distributor ${directDistributor.id}`, constants_1.loggerCtx);
            if (directDistributor.parentId) {
                const indirectRate = (_f = (_e = ctx.channel.customFields) === null || _e === void 0 ? void 0 : _e.indirectCommissionRate) !== null && _f !== void 0 ? _f : 500;
                const indirectAmount = Math.floor(orderTotal * indirectRate / 10000);
                const indirectRecord = new commission_record_entity_1.CommissionRecord({
                    distributorId: String(directDistributor.parentId),
                    orderId: String(order.id),
                    fromDistributorId: String(directDistributor.id),
                    commissionType: 'indirect',
                    commissionRate: indirectRate,
                    orderAmount: orderTotal,
                    commissionAmount: indirectAmount,
                    status: 'pending',
                    settledAt: null,
                });
                indirectRecord.channels = [channel];
                await this.connection.getRepository(ctx, commission_record_entity_1.CommissionRecord).save(indirectRecord);
                core_1.Logger.info(`Created indirect commission ${indirectAmount} for distributor ${directDistributor.parentId}`, constants_1.loggerCtx);
            }
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    findAll(ctx, options) {
        return this.listQueryBuilder
            .build(commission_record_entity_1.CommissionRecord, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    findByDistributor(ctx, distributorId, options) {
        return this.listQueryBuilder
            .build(commission_record_entity_1.CommissionRecord, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
            where: { distributorId },
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async settlePendingCommissions(ctx) {
        var _a, _b;
        const settlementDays = (_b = (_a = ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.commissionSettlementDays) !== null && _b !== void 0 ? _b : 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - settlementDays);
        const repo = this.connection.getRepository(ctx, commission_record_entity_1.CommissionRecord);
        const pendingRecords = await repo
            .createQueryBuilder('record')
            .leftJoinAndSelect('record.channels', 'channel')
            .where('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('record.status = :status', { status: 'pending' })
            .andWhere('record.createdAt <= :cutoffDate', { cutoffDate })
            .getMany();
        let settledCount = 0;
        for (const record of pendingRecords) {
            record.status = 'confirmed';
            record.settledAt = new Date();
            await repo.save(record);
            const distributor = await this.connection.getEntityOrThrow(ctx, distributor_entity_1.Distributor, record.distributorId);
            distributor.availableBalance += record.commissionAmount;
            distributor.totalEarnings += record.commissionAmount;
            await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
            settledCount++;
        }
        if (settledCount > 0) {
            core_1.Logger.info(`Settled ${settledCount} pending commissions`, constants_1.loggerCtx);
        }
        return settledCount;
    }
    /**
     * 退款冲销：反查 orderId 对应的 CommissionRecord，pending/confirmed 置 cancelled；
     * 已 confirmed 的还需扣回 distributor.availableBalance。
     */
    async cancelCommissionByOrder(ctx, orderId) {
        const repo = this.connection.getRepository(ctx, commission_record_entity_1.CommissionRecord);
        const records = await repo.find({ where: { orderId } });
        let cancelledCount = 0;
        for (const record of records) {
            if (record.status !== 'pending' && record.status !== 'confirmed') {
                continue;
            }
            const wasConfirmed = record.status === 'confirmed';
            record.status = 'cancelled';
            await repo.save(record);
            if (wasConfirmed) {
                const distributor = await this.connection.getEntityOrThrow(ctx, distributor_entity_1.Distributor, record.distributorId);
                distributor.availableBalance -= record.commissionAmount;
                if (distributor.availableBalance < 0) {
                    distributor.availableBalance = 0;
                }
                await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
            }
            cancelledCount++;
        }
        if (cancelledCount > 0) {
            core_1.Logger.info(`Cancelled ${cancelledCount} commission records for order ${orderId}`, constants_1.loggerCtx);
        }
        return cancelledCount;
    }
};
exports.CommissionService = CommissionService;
exports.CommissionService = CommissionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        distribution_service_1.DistributionService,
        core_1.EventBus])
], CommissionService);
//# sourceMappingURL=commission.service.js.map