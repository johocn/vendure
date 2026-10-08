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
 * 提现即扣减余额（冻结语义：frozen = PENDING 申请合计），驳回退回、打款仅留痕。
 * 骑手为平台级能力：资金操作与流水的渠道上下文固定为默认渠道（platformCtx），
 * 不随调用方（骑手端无渠道头、管理端选店）的 channelToken 漂移。 */
let RiderWalletService = class RiderWalletService {
    constructor(connection, riderService, requestContextService) {
        this.connection = connection;
        this.riderService = riderService;
        this.requestContextService = requestContextService;
    }
    /** 默认渠道上下文：余额端口与提现记录统一在此渠道下读写 */
    async platformCtx() {
        return this.requestContextService.create({ apiType: 'admin' });
    }
    async myRiderWallet(ctx) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        await this.settlePendingEarnings(pc, rider.id);
        const port = (0, coupon_plugin_1.getCouponBalancePort)();
        const available = port ? await port.getBalance(pc, rider.id) : 0;
        const frozen = await this.sumPending(pc, rider.id);
        const totalEarned = await this.sumEarned(pc, rider.id);
        return { available, frozen, totalEarned };
    }
    /** 分成入账失败的自愈补账：deliver 落 pending 后入账失败/未注册端口的记录，读取钱包时重试入账 */
    async settlePendingEarnings(pc, riderCustomerId) {
        var _a;
        const port = (0, coupon_plugin_1.getCouponBalancePort)();
        if (!port)
            return;
        const repo = this.connection.getRepository(pc, rider_earning_entity_1.RiderEarning);
        const pending = await repo.find({
            where: { riderCustomerId, status: 'pending' },
            take: 50,
        });
        for (const row of pending) {
            try {
                await port.addBalance(pc, riderCustomerId, row.amount);
                await repo.update(row.id, { status: 'credited' });
                common_1.Logger.warn(`补账成功：earning ${row.id}（${row.amount} 分）`, 'RiderWallet');
            }
            catch (e) {
                common_1.Logger.error(`补账失败：earning ${row.id}：${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, 'RiderWallet');
                break; // 余额端口异常时停止本轮，避免逐条打错误
            }
        }
    }
    /** 余额流水（recharge-card BalanceTransaction，默认渠道本人倒序） */
    async riderBalanceHistory(ctx, skip, take) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        return this.connection
            .getRepository(pc, recharge_card_plugin_1.BalanceTransaction)
            .createQueryBuilder('tx')
            .where('tx.customerId = :id', { id: rider.id })
            .andWhere('tx.channelId = :ch', { ch: pc.channelId })
            .orderBy('tx.createdAt', 'DESC')
            .skip(skip !== null && skip !== void 0 ? skip : 0)
            .take(take !== null && take !== void 0 ? take : 20)
            .getMany();
    }
    /** 本人提现申请记录（平台级，倒序） */
    async riderWithdrawRequests(ctx, skip, take) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        return this.connection
            .getRepository(pc, rider_withdrawal_entity_1.RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .where('w.customerId = :id', { id: rider.id })
            .orderBy('w.createdAt', 'DESC')
            .skip(skip !== null && skip !== void 0 ? skip : 0)
            .take(take !== null && take !== void 0 ? take : 20)
            .getMany();
    }
    /** 提现申请：校验骑手 + ≥¥10 + 无在途申请 + ≤可提现 → 扣款冻结 → PENDING 申请 */
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
        const pc = await this.platformCtx();
        const port = (0, coupon_plugin_1.getCouponBalancePort)();
        if (!port)
            throw new core_1.UserInputError('余额功能未开通');
        // F2 并发防重：余额端口的 add/deduct 自带事务提交（startTransaction+commitOpenTransaction），
        // 不能与外层事务同 ctx 嵌套，故用 rawConnection 独立事务 + Customer 行悲观锁把
        // 「防重检查→余额校验→扣款→落库」对同骑手串行化：并发双请求只有一个能通过 PENDING 检查。
        // 残余风险（与历史一致且窗口极小）：扣款成功后 raw 事务提交失败 → 已扣无单，需人工对账。
        return this.connection.rawConnection.transaction(async (em) => {
            // 裸 SQL 行锁：Customer 实体 findOne+lock 会 LEFT JOIN channels 等关联表，
            // PG 拒绝对外连接可空侧 FOR UPDATE，故用单表 SELECT ... FOR UPDATE
            await em.query('SELECT id FROM customer WHERE id = $1 FOR UPDATE', [rider.id]);
            const pending = await em.getRepository(rider_withdrawal_entity_1.RiderWithdrawalRequest).count({
                where: { customerId: rider.id, status: 'PENDING' },
            });
            if (pending > 0)
                throw new core_1.UserInputError('您有审核中的提现申请，请等待审核完成');
            const available = await port.getBalance(pc, rider.id);
            if (amount > available)
                throw new core_1.UserInputError('超过可提现余额');
            await port.deductBalance(pc, rider.id, amount);
            return em.getRepository(rider_withdrawal_entity_1.RiderWithdrawalRequest).save({
                customerId: rider.id,
                channelId: pc.channelId,
                amount,
                channel: input.channel.trim(),
                account: input.account.trim(),
                status: 'PENDING',
            });
        });
    }
    /** 管理端：提现申请列表（status=ALL 或具体状态；平台级，不限定选店渠道） */
    async adminList(ctx, status, skip, take) {
        const pc = await this.platformCtx();
        const qb = this.connection.getRepository(pc, rider_withdrawal_entity_1.RiderWithdrawalRequest).createQueryBuilder('w');
        if (status && status !== 'ALL') {
            qb.andWhere('w.status = :s', { s: status });
        }
        return qb.orderBy('w.createdAt', 'DESC').skip(skip !== null && skip !== void 0 ? skip : 0).take(take !== null && take !== void 0 ? take : 20).getMany();
    }
    /** 管理端：通过打款（仅留痕，金额已在申请时扣减） */
    async adminApprove(ctx, id, remark) {
        const req = await this.getForReview(id);
        const pc = await this.platformCtx();
        const repo = this.connection.getRepository(pc, rider_withdrawal_entity_1.RiderWithdrawalRequest);
        // 原子认领：条件更新仅当仍为 PENDING 时生效，防并发双审
        const claim = await repo.update(req.id, {
            status: 'PAID',
            remark: (remark === null || remark === void 0 ? void 0 : remark.trim()) || req.remark || null,
            reviewedBy: this.reviewer(ctx),
            reviewedAt: new Date(),
        });
        if (claim && claim.affected === 0)
            throw new core_1.UserInputError('该申请已处理');
        return repo.findOne({ where: { id: req.id } });
    }
    /** 管理端：驳回（退回冻结金额 + 留痕；退回资金固定默认渠道，与申请扣款同渠道） */
    async adminReject(ctx, id, remark) {
        var _a;
        const pc = await this.platformCtx();
        const repo = this.connection.getRepository(pc, rider_withdrawal_entity_1.RiderWithdrawalRequest);
        const req = await repo.findOne({ where: { id } });
        if (!req)
            throw new core_1.UserInputError('提现申请不存在');
        // F3 原子认领：条件更新仅当仍为 PENDING 时生效，防并发双审 → 双重退回；
        // 先改状态再退回，退回失败补偿恢复 PENDING 以便重试（避免「已驳回但钱未退」）
        const claim = await repo.update(req.id, {
            status: 'REJECTED',
            remark: (remark === null || remark === void 0 ? void 0 : remark.trim()) || req.remark || null,
            reviewedBy: this.reviewer(ctx),
            reviewedAt: new Date(),
        });
        if (claim && claim.affected === 0)
            throw new core_1.UserInputError('该申请已处理');
        const port = (0, coupon_plugin_1.getCouponBalancePort)();
        if (port) {
            try {
                await port.addBalance(pc, req.customerId, req.amount);
            }
            catch (e) {
                await repo.update(req.id, { status: 'PENDING' }).catch(() => undefined);
                common_1.Logger.error(`驳回退回失败（已恢复 PENDING 可重试）：${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, 'RiderWallet');
                throw new core_1.UserInputError('退回失败，请稍后重试');
            }
        }
        else {
            common_1.Logger.warn('余额端口未注册，驳回退回未执行', 'RiderWallet');
        }
        return repo.findOne({ where: { id: req.id } });
    }
    reviewer(ctx) {
        return ctx.activeUserId ? String(ctx.activeUserId) : null;
    }
    /** 审核前置校验（平台级：不限定 channelId） */
    async getForReview(id) {
        const pc = await this.platformCtx();
        const req = await this.connection.getRepository(pc, rider_withdrawal_entity_1.RiderWithdrawalRequest).findOne({ where: { id } });
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
        // 骑手为平台级角色：分成流水写在各店铺渠道，钱包查询固定默认渠道上下文，
        // 按渠道过滤会导致累计收入恒为 0，此处跨渠道汇总
        const row = await this.connection
            .getRepository(ctx, rider_earning_entity_1.RiderEarning)
            .createQueryBuilder('e')
            .select('COALESCE(SUM(e.amount + e.tip), 0)', 'sum')
            .where('e.riderCustomerId = :id', { id: riderCustomerId })
            .getRawOne();
        return Number(row === null || row === void 0 ? void 0 : row.sum) || 0;
    }
};
exports.RiderWalletService = RiderWalletService;
exports.RiderWalletService = RiderWalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        rider_service_1.RiderService,
        core_1.RequestContextService])
], RiderWalletService);
//# sourceMappingURL=rider-wallet.service.js.map