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
exports.WithdrawalService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const withdrawal_request_entity_1 = require("./withdrawal-request.entity");
const distributor_entity_1 = require("./distributor.entity");
const distribution_service_1 = require("./distribution.service");
const constants_1 = require("./constants");
let WithdrawalService = class WithdrawalService {
    constructor(connection, listQueryBuilder, distributionService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.distributionService = distributionService;
    }
    findAll(ctx, options) {
        return this.listQueryBuilder
            .build(withdrawal_request_entity_1.WithdrawalRequest, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    findByDistributor(ctx, distributorId, options) {
        return this.listQueryBuilder
            .build(withdrawal_request_entity_1.WithdrawalRequest, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
            where: { distributorId },
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async request(ctx, distributorId, amount, method, accountInfo) {
        var _a, _b;
        const minAmount = (_b = (_a = ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.minWithdrawalAmount) !== null && _b !== void 0 ? _b : 10000;
        if (amount < minAmount) {
            throw new Error(`Minimum withdrawal amount is ${minAmount}`);
        }
        const distributor = await this.distributionService.findOne(ctx, distributorId);
        if (!distributor) {
            throw new Error(`Distributor ${distributorId} not found`);
        }
        if (distributor.availableBalance < amount) {
            throw new Error('Insufficient available balance');
        }
        distributor.availableBalance -= amount;
        distributor.frozenBalance += amount;
        await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
        const request = new withdrawal_request_entity_1.WithdrawalRequest({
            distributorId: String(distributorId),
            amount,
            method,
            accountInfo,
            status: 'pending',
        });
        const channel = await this.connection.getEntityOrThrow(ctx, 'Channel', ctx.channelId);
        request.channels = [channel];
        const saved = await this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest).save(request);
        core_1.Logger.info(`Withdrawal request ${saved.id} created for distributor ${distributorId}, amount ${amount}`, constants_1.loggerCtx);
        return saved;
    }
    async approve(ctx, id) {
        const repo = this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest);
        const request = await repo.findOne({ where: { id } });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        request.status = 'approved';
        request.reviewedAt = new Date();
        return repo.save(request);
    }
    async reject(ctx, id) {
        const repo = this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest);
        const request = await repo.findOne({ where: { id } });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        request.status = 'rejected';
        request.reviewedAt = new Date();
        const distributor = await this.connection.getEntityOrThrow(ctx, distributor_entity_1.Distributor, request.distributorId);
        distributor.frozenBalance -= request.amount;
        distributor.availableBalance += request.amount;
        await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
        return repo.save(request);
    }
    async markPaid(ctx, id) {
        const repo = this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest);
        const request = await repo.findOne({ where: { id } });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        request.status = 'paid';
        request.paidAt = new Date();
        const distributor = await this.connection.getEntityOrThrow(ctx, distributor_entity_1.Distributor, request.distributorId);
        distributor.frozenBalance -= request.amount;
        await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
        return repo.save(request);
    }
};
exports.WithdrawalService = WithdrawalService;
exports.WithdrawalService = WithdrawalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        distribution_service_1.DistributionService])
], WithdrawalService);
//# sourceMappingURL=withdrawal.service.js.map