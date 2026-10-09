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
exports.BalanceWithdrawalService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const balance_transaction_entity_1 = require("./balance-transaction.entity");
const balance_withdrawal_request_entity_1 = require("./balance-withdrawal-request.entity");
const constants_1 = require("./constants");
const customer_balance_entity_1 = require("./customer-balance.entity");
const MIN_WITHDRAWAL_AMOUNT = 1000; // 分，¥10 起提
let BalanceWithdrawalService = class BalanceWithdrawalService {
    constructor(connection, listQueryBuilder, customerService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
    }
    /**
     * 与 RechargeCardService.resolveCustomerId 同款口径：经 customerService.findOneByUserId
     * 把会话的 User.id 解析成 Customer.id，保证与既有余额键一致
     * （User.id vs Customer.id 混用会导致同一账户余额/流水分裂）。
     */
    async resolveCustomerId(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UserInputError('Must be logged in');
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.UserInputError('Customer not found');
        }
        return Number(customer.id);
    }
    async myBalance(ctx) {
        var _a, _b;
        const cid = await this.resolveCustomerId(ctx);
        const row = await this.connection
            .getRepository(ctx, customer_balance_entity_1.CustomerBalance)
            .findOne({ where: { customerId: cid, channelId: ctx.channelId } });
        return { balance: (_a = row === null || row === void 0 ? void 0 : row.balance) !== null && _a !== void 0 ? _a : 0, frozenBalance: (_b = row === null || row === void 0 ? void 0 : row.frozenBalance) !== null && _b !== void 0 ? _b : 0 };
    }
    async findMyRequests(ctx, options) {
        const cid = await this.resolveCustomerId(ctx);
        // 渠道/客户维度并入标准 filter 交给 ListQueryBuilder 统一转义（同包 scopedOptions 口径，
        // 手写 andWhere 不加引号在 Postgres 会被折叠成小写报「列不存在」）
        return this.listQueryBuilder
            .build(balance_withdrawal_request_entity_1.BalanceWithdrawalRequest, {
            skip: options === null || options === void 0 ? void 0 : options.skip,
            take: options === null || options === void 0 ? void 0 : options.take,
            filter: { channelId: { eq: ctx.channelId }, customerId: { eq: cid } },
        }, { ctx })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findAll(ctx, options) {
        const filter = { channelId: { eq: ctx.channelId } };
        if (options === null || options === void 0 ? void 0 : options.status) {
            filter.status = { eq: options.status };
        }
        return this.listQueryBuilder
            .build(balance_withdrawal_request_entity_1.BalanceWithdrawalRequest, { skip: options === null || options === void 0 ? void 0 : options.skip, take: options === null || options === void 0 ? void 0 : options.take, filter }, { ctx })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /**
     * 申请提现：原子条件扣减 balance 并入 frozenBalance（仿 distribution withdrawal.service.ts:77-90）。
     * 并发申请时只有余额仍充足的那笔能成功，避免「读余额 → 校验 → 写回」竞态多开提现单。
     */
    async request(ctx, amount, method, accountInfo) {
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
            throw new core_1.UserInputError('Invalid withdrawal amount');
        }
        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            throw new core_1.UserInputError(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT} (cents)`);
        }
        if (!(accountInfo === null || accountInfo === void 0 ? void 0 : accountInfo.trim())) {
            throw new core_1.UserInputError('accountInfo is required');
        }
        const cid = await this.resolveCustomerId(ctx);
        const balanceRepo = this.connection.getRepository(ctx, customer_balance_entity_1.CustomerBalance);
        const row = await balanceRepo.findOne({
            where: { customerId: cid, channelId: ctx.channelId },
        });
        if (!row) {
            throw new core_1.UserInputError('Insufficient balance');
        }
        // 原子条件扣减：列名为 camelCase（TypeORM 建列带双引号），Postgres 下必须显式加双引号，
        // 否则未加引号的标识符被折叠成小写而报「列不存在」。
        const claim = await balanceRepo
            .createQueryBuilder()
            .update(customer_balance_entity_1.CustomerBalance)
            .set({
            balance: () => `"balance" - ${amount}`,
            frozenBalance: () => `"frozenBalance" + ${amount}`,
        })
            .where('id = :id', { id: row.id })
            .andWhere(`"balance" >= ${amount}`)
            .execute();
        if (claim.affected === 0) {
            throw new core_1.UserInputError('Insufficient balance');
        }
        const after = await balanceRepo.findOneByOrFail({ id: row.id });
        await this.connection.getRepository(ctx, balance_transaction_entity_1.BalanceTransaction).save({
            customerId: cid,
            channelId: ctx.channelId,
            type: balance_transaction_entity_1.BalanceTransactionType.FREEZE,
            amount: -amount,
            balanceBefore: row.balance,
            balanceAfter: after.balance,
            remark: '提现冻结',
        });
        const saved = await this.connection.getRepository(ctx, balance_withdrawal_request_entity_1.BalanceWithdrawalRequest).save({
            customerId: cid,
            amount,
            method,
            accountInfo: accountInfo.trim(),
            status: 'pending',
            channelId: ctx.channelId,
        });
        core_1.Logger.info(`Balance withdrawal ${saved.id} requested by customer ${cid}, amount ${amount}`, constants_1.loggerCtx);
        return saved;
    }
    /**
     * 审核状态流转：pending → approved → paid，pending/approved → rejected。
     * 用「带原状态条件的原子更新」完成流转（仿 distribution withdrawal.service.ts:114-138），
     * 保证并发或重复调用时只有一次能成功——否则重复 reject 会对同一笔提现二次回补余额。
     * 调用方（resolver）已包 @Transaction()，此处与余额变更同事务。
     */
    async transition(ctx, id, from, patch) {
        const repo = this.connection.getRepository(ctx, balance_withdrawal_request_entity_1.BalanceWithdrawalRequest);
        const claim = await repo
            .createQueryBuilder()
            .update(balance_withdrawal_request_entity_1.BalanceWithdrawalRequest)
            .set(patch)
            .where('id = :id', { id })
            .andWhere('status IN (:...from)', { from })
            .execute();
        const request = await repo.findOne({ where: { id } });
        if (!request) {
            throw new Error(`BalanceWithdrawalRequest ${id} not found`);
        }
        if (!claim.affected) {
            throw new core_1.UserInputError(`Withdrawal request ${id} is ${request.status}, cannot be marked as ${patch.status}`);
        }
        return request;
    }
    async approve(ctx, id, remark) {
        return this.transition(ctx, id, ['pending'], {
            status: 'approved',
            reviewedAt: new Date(),
            remark: remark !== null && remark !== void 0 ? remark : null,
        });
    }
    /** 驳回：解冻回补 balance，写 UNFREEZE 流水（transition 只成功一次 → 不会重复回补） */
    async reject(ctx, id, remark) {
        const request = await this.transition(ctx, id, ['pending', 'approved'], {
            status: 'rejected',
            reviewedAt: new Date(),
            remark: remark !== null && remark !== void 0 ? remark : '驳回',
        });
        const balanceRepo = this.connection.getRepository(ctx, customer_balance_entity_1.CustomerBalance);
        const row = await balanceRepo.findOneByOrFail({
            customerId: request.customerId,
            channelId: request.channelId,
        });
        const before = row.balance;
        row.frozenBalance -= request.amount;
        row.balance += request.amount;
        await balanceRepo.save(row);
        await this.connection.getRepository(ctx, balance_transaction_entity_1.BalanceTransaction).save({
            customerId: request.customerId,
            channelId: request.channelId,
            type: balance_transaction_entity_1.BalanceTransactionType.UNFREEZE,
            amount: request.amount,
            balanceBefore: before,
            balanceAfter: row.balance,
            remark: '提现驳回退回',
        });
        core_1.Logger.info(`Balance withdrawal ${request.id} rejected, refunded ${request.amount} to customer ${request.customerId}`, constants_1.loggerCtx);
        return request;
    }
    /** 打款完成：冻结出账（balance 不变，无流水） */
    async markPaid(ctx, id) {
        const request = await this.transition(ctx, id, ['approved'], { status: 'paid', paidAt: new Date() });
        const balanceRepo = this.connection.getRepository(ctx, customer_balance_entity_1.CustomerBalance);
        const row = await balanceRepo.findOneByOrFail({
            customerId: request.customerId,
            channelId: request.channelId,
        });
        row.frozenBalance -= request.amount;
        await balanceRepo.save(row);
        core_1.Logger.info(`Balance withdrawal ${request.id} marked paid, cleared ${request.amount} frozen for customer ${request.customerId}`, constants_1.loggerCtx);
        return request;
    }
};
exports.BalanceWithdrawalService = BalanceWithdrawalService;
exports.BalanceWithdrawalService = BalanceWithdrawalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService])
], BalanceWithdrawalService);
//# sourceMappingURL=balance-withdrawal.service.js.map