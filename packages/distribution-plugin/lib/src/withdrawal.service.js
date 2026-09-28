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
const typeorm_1 = require("typeorm");
const account_crypto_1 = require("./account-crypto");
const commission_record_entity_1 = require("./commission-record.entity");
const distributor_entity_1 = require("./distributor.entity");
const distribution_service_1 = require("./distribution.service");
const constants_1 = require("./constants");
const withdrawal_request_entity_1 = require("./withdrawal-request.entity");
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
            .then(([items, totalItems]) => {
            items.forEach(item => {
                item.accountInfo = (0, account_crypto_1.decryptAccount)(item.accountInfo);
            });
            return { items, totalItems };
        });
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
            .then(([items, totalItems]) => {
            items.forEach(item => {
                item.accountInfo = (0, account_crypto_1.decryptAccount)(item.accountInfo);
            });
            return { items, totalItems };
        });
    }
    async request(ctx, distributorId, amount, method, accountInfo) {
        var _a, _b;
        const minAmount = (_b = (_a = ctx.channel.customFields) === null || _a === void 0 ? void 0 : _a.minWithdrawalAmount) !== null && _b !== void 0 ? _b : 10000;
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
            throw new core_1.UserInputError('Invalid withdrawal amount');
        }
        if (amount < minAmount) {
            throw new core_1.UserInputError(`Minimum withdrawal amount is ${minAmount} (cents)`);
        }
        const distributor = await this.distributionService.findOne(ctx, distributorId);
        if (!distributor) {
            throw new core_1.UserInputError(`Distributor ${distributorId} not found`);
        }
        // 原子条件扣减：并发提现时只有余额仍充足的那笔能成功，
        // 避免「读余额 → 校验 → 写回」之间的竞态导致多开提现单而余额只扣一次。
        // 列名为 camelCase（TypeORM 用双引号建列），Postgres 下必须显式加双引号，
        // 否则未加引号的标识符会被折叠成小写而报「列不存在」。
        const claim = await this.connection
            .getRepository(ctx, distributor_entity_1.Distributor)
            .createQueryBuilder()
            .update(distributor_entity_1.Distributor)
            .set({
            availableBalance: () => `"availableBalance" - ${amount}`,
            frozenBalance: () => `"frozenBalance" + ${amount}`,
        })
            .where('id = :id', { id: distributor.id })
            .andWhere(`"availableBalance" >= ${amount}`)
            .execute();
        if (claim.affected === 0) {
            throw new core_1.UserInputError('Insufficient available balance');
        }
        const request = new withdrawal_request_entity_1.WithdrawalRequest({
            distributorId: String(distributorId),
            amount,
            method,
            accountInfo: (0, account_crypto_1.encryptAccount)(accountInfo),
            status: 'pending',
        });
        const channel = await this.connection.getEntityOrThrow(ctx, 'Channel', ctx.channelId);
        request.channels = [channel];
        const saved = await this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest).save(request);
        saved.accountInfo = (0, account_crypto_1.decryptAccount)(saved.accountInfo);
        core_1.Logger.info(`Withdrawal request ${saved.id} created for distributor ${distributorId}, amount ${amount}`, constants_1.loggerCtx);
        return saved;
    }
    /**
     * 审核状态流转：pending → approved → paid，pending/approved → rejected。
     * 用「带原状态条件的原子更新」完成流转，保证并发或重复调用时只有一次能成功——
     * 否则重复 reject 会对同一笔提现二次回补余额，导致可用余额虚增、冻结余额变负。
     * 调用方（resolver）已包 @Transaction()，此处与余额变更同事务。
     */
    async transition(ctx, id, from, patch) {
        const repo = this.connection.getRepository(ctx, withdrawal_request_entity_1.WithdrawalRequest);
        const claim = await repo
            .createQueryBuilder()
            .update(withdrawal_request_entity_1.WithdrawalRequest)
            .set(patch)
            .where('id = :id', { id })
            .andWhere('status IN (:...from)', { from })
            .execute();
        const request = await repo.findOne({ where: { id } });
        if (!request) {
            throw new Error(`WithdrawalRequest ${id} not found`);
        }
        if (!claim.affected) {
            throw new core_1.UserInputError(`Withdrawal request ${id} is ${request.status}, cannot be marked as ${patch.status}`);
        }
        return request;
    }
    async approve(ctx, id) {
        const request = await this.transition(ctx, id, ['pending'], { status: 'approved', reviewedAt: new Date() });
        request.accountInfo = (0, account_crypto_1.decryptAccount)(request.accountInfo);
        return request;
    }
    async reject(ctx, id) {
        const request = await this.transition(ctx, id, ['pending', 'approved'], { status: 'rejected', reviewedAt: new Date() });
        // 冻结额度退回可用余额。因上面的状态流转只会成功一次，此处不会重复回补。
        const distributor = await this.connection.getEntityOrThrow(ctx, distributor_entity_1.Distributor, request.distributorId);
        distributor.frozenBalance -= request.amount;
        distributor.availableBalance += request.amount;
        await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
        request.accountInfo = (0, account_crypto_1.decryptAccount)(request.accountInfo);
        return request;
    }
    async markPaid(ctx, id) {
        const request = await this.transition(ctx, id, ['approved'], { status: 'paid', paidAt: new Date() });
        const distributor = await this.connection.getEntityOrThrow(ctx, distributor_entity_1.Distributor, request.distributorId);
        distributor.frozenBalance -= request.amount;
        await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
        // 联动 CommissionRecord：将该分销商 pending/confirmed 佣金记录置 paid
        const commissionRepo = this.connection.getRepository(ctx, commission_record_entity_1.CommissionRecord);
        const pendingRecords = await commissionRepo.find({
            where: {
                distributorId: request.distributorId,
                status: (0, typeorm_1.In)(['pending', 'confirmed']),
            },
        });
        for (const record of pendingRecords) {
            record.status = 'paid';
            await commissionRepo.save(record);
        }
        if (pendingRecords.length > 0) {
            core_1.Logger.info(`Marked ${pendingRecords.length} commission records as paid for distributor ${request.distributorId}`, constants_1.loggerCtx);
        }
        request.accountInfo = (0, account_crypto_1.decryptAccount)(request.accountInfo);
        return request;
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