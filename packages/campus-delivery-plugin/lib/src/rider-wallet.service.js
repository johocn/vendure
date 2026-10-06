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
exports.RiderWalletService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const recharge_card_plugin_1 = require("@vendure/recharge-card-plugin");
const rider_earning_entity_1 = require("./rider-earning.entity");
const rider_service_1 = require("./rider.service");
const rider_withdrawal_entity_1 = require("./rider-withdrawal.entity");
const MIN_WITHDRAW_AMOUNT = 1000; // 最低提现 ¥10（分）
/** 骑手钱包：余额底座复用 coupon-balance-port（recharge-card CustomerBalance）。
 * 提现即扣减余额（冻结语义：frozen = PENDING 申请合计），驳回退回、打款仅留痕。 */
let RiderWalletService = class RiderWalletService {
    constructor(connection, riderService) {
        this.connection = connection;
        this.riderService = riderService;
    }
    async myRiderWallet(ctx) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const port = (0, coupon_plugin_1.getCouponBalancePort)();
        const available = port ? await port.getBalance(ctx, rider.id) : 0;
        const frozen = await this.sumPending(ctx, rider.id);
        const totalEarned = await this.sumEarned(ctx, rider.id);
        return { available, frozen, totalEarned };
    }
    /** 余额流水（recharge-card BalanceTransaction，本渠道本人倒序） */
    async riderBalanceHistory(ctx, skip, take) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection
            .getRepository(ctx, recharge_card_plugin_1.BalanceTransaction)
            .createQueryBuilder('tx')
            .where('tx.customerId = :id', { id: rider.id })
            .andWhere('tx.channelId = :ch', { ch: ctx.channelId })
            .orderBy('tx.createdAt', 'DESC')
            .skip(skip !== null && skip !== void 0 ? skip : 0)
            .take(take !== null && take !== void 0 ? take : 20)
            .getMany();
    }
    /** 本人提现申请记录（倒序） */
    async riderWithdrawRequests(ctx, skip, take) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection
            .getRepository(ctx, rider_withdrawal_entity_1.RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .where('w.customerId = :id', { id: rider.id })
            .orderBy('w.createdAt', 'DESC')
            .skip(skip !== null && skip !== void 0 ? skip : 0)
            .take(take !== null && take !== void 0 ? take : 20)
            .getMany();
    }
    /** 提现申请：校验骑手 + ≥¥10 + ≤可提现 → 扣款冻结 → PENDING 申请 */
    async riderWithdraw(ctx, input) {
        var _a, _b;
        const rider = await this.riderService.assertApprovedRider(ctx);
        const amount = Math.floor(input.amount);
        if (!amount || amount < MIN_WITHDRAW_AMOUNT)
            throw new core_1.UserInputError('最低提现金额为 ¥10');
        if (!((_a = input.channel) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new core_1.UserInputError('请选择收款渠道');
        if (!((_b = input.account) === null || _b === void 0 ? void 0 : _b.trim()))
            throw new core_1.UserInputError('请填写收款账号');
        const port = (0, coupon_plugin_1.getCouponBalancePort)();
        if (!port)
            throw new core_1.UserInputError('余额功能未开通');
        const available = await port.getBalance(ctx, rider.id);
        if (amount > available)
            throw new core_1.UserInputError('超过可提现余额');
        await port.deductBalance(ctx, rider.id, amount);
        return this.connection.getRepository(ctx, rider_withdrawal_entity_1.RiderWithdrawalRequest).save({
            customerId: rider.id,
            channelId: ctx.channelId,
            amount,
            channel: input.channel.trim(),
            account: input.account.trim(),
            status: 'PENDING',
        });
    }
    /** 管理端：提现申请列表（status=ALL 或具体状态，渠道隔离） */
    async adminList(ctx, status, skip, take) {
        const qb = this.connection
            .getRepository(ctx, rider_withdrawal_entity_1.RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .where('w.channelId = :ch', { ch: ctx.channelId });
        if (status && status !== 'ALL') {
            qb.andWhere('w.status = :s', { s: status });
        }
        return qb.orderBy('w.createdAt', 'DESC').skip(skip !== null && skip !== void 0 ? skip : 0).take(take !== null && take !== void 0 ? take : 20).getMany();
    }
    /** 管理端：通过打款（仅留痕，金额已在申请时扣减） */
    async adminApprove(ctx, id, remark) {
        const req = await this.getForReview(ctx, id);
        const repo = this.connection.getRepository(ctx, rider_withdrawal_entity_1.RiderWithdrawalRequest);
        await repo.update(req.id, {
            status: 'PAID',
            remark: (remark === null || remark === void 0 ? void 0 : remark.trim()) || req.remark || null,
            reviewedBy: this.reviewer(ctx),
            reviewedAt: new Date(),
        });
        return repo.findOne({ where: { id: req.id } });
    }
    /** 管理端：驳回（退回冻结金额 + 留痕） */
    async adminReject(ctx, id, remark) {
        const req = await this.getForReview(ctx, id);
        const port = (0, coupon_plugin_1.getCouponBalancePort)();
        if (port) {
            await port.addBalance(ctx, req.customerId, req.amount);
        }
        else {
            common_1.Logger.warn('余额端口未注册，驳回退回未执行', 'RiderWallet');
        }
        const repo = this.connection.getRepository(ctx, rider_withdrawal_entity_1.RiderWithdrawalRequest);
        await repo.update(req.id, {
            status: 'REJECTED',
            remark: (remark === null || remark === void 0 ? void 0 : remark.trim()) || req.remark || null,
            reviewedBy: this.reviewer(ctx),
            reviewedAt: new Date(),
        });
        return repo.findOne({ where: { id: req.id } });
    }
    reviewer(ctx) {
        return ctx.activeUserId ? String(ctx.activeUserId) : null;
    }
    async getForReview(ctx, id) {
        const req = await this.connection
            .getRepository(ctx, rider_withdrawal_entity_1.RiderWithdrawalRequest)
            .findOne({ where: { id, channelId: ctx.channelId } });
        if (!req)
            throw new core_1.UserInputError('提现申请不存在');
        if (req.status !== 'PENDING')
            throw new core_1.UserInputError('该申请已处理');
        return req;
    }
    async sumPending(ctx, customerId) {
        const row = await this.connection
            .getRepository(ctx, rider_withdrawal_entity_1.RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .select('COALESCE(SUM(w.amount), 0)', 'sum')
            .where('w.customerId = :id', { id: customerId })
            .andWhere('w.status = :s', { s: 'PENDING' })
            .getRawOne();
        return Number(row === null || row === void 0 ? void 0 : row.sum) || 0;
    }
    async sumEarned(ctx, riderCustomerId) {
        const row = await this.connection
            .getRepository(ctx, rider_earning_entity_1.RiderEarning)
            .createQueryBuilder('e')
            .select('COALESCE(SUM(e.amount + e.tip), 0)', 'sum')
            .where('e.riderCustomerId = :id', { id: riderCustomerId })
            .andWhere('e.channelId = :ch', { ch: ctx.channelId })
            .getRawOne();
        return Number(row === null || row === void 0 ? void 0 : row.sum) || 0;
    }
};
exports.RiderWalletService = RiderWalletService;
exports.RiderWalletService = RiderWalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, rider_service_1.RiderService])
], RiderWalletService);
//# sourceMappingURL=rider-wallet.service.js.map