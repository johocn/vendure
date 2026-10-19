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
exports.CouponSettlementService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const constants_1 = require("./constants");
const coupon_settlement_adapter_1 = require("./coupon-settlement-adapter");
const coupon_settlement_order_entity_1 = require("./coupon-settlement-order.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const in_store_bill_entity_1 = require("./in-store-bill.entity");
/** 汇总出单上限（单次循环处理条数，防止一次性大事务） */
const CYCLE_BATCH = 200;
/**
 * 券结算服务（买单券资金流 T1/T3 编排）：
 * - registerFromBill：核销（到店买单）成功后同步登记待结算单（幂等，失败不阻断核销）
 * - runSettlementCycle：T+1 汇总 job——① 兜底补登（唯一约束防重复出单）
 *   ② 提交分账（幂等键 = 结算单号，带原状态条件原子更新，风险铁律④）③ 回执推进
 * P0 结算口径：仅到店核销（InStoreBill）登记结算——线上订单核销的面额折算需订单级折扣捕获，
 * 与退款联动（T8）一并列入后续任务；线上券继续走原有订单资金流，不受本服务影响。
 */
let CouponSettlementService = class CouponSettlementService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 佣金费率快照来源：环境变量 COUPON_SPLIT_COMMISSION_BP（万分比，默认 0 = 平台暂不分佣） */
    commissionRateBp() {
        var _a;
        const v = Math.floor(Number((_a = process.env.COUPON_SPLIT_COMMISSION_BP) !== null && _a !== void 0 ? _a : 0));
        return Number.isFinite(v) && v > 0 ? v : 0;
    }
    /** T+1 界线：今天零点（核销发生在今天零点之前 = 已满一天，可提交分账） */
    settlementCutoff() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    /**
     * 核销 → 待结算登记（幂等：customerCouponId 唯一约束）。
     * 在核销事务内调用；任何失败只记日志不抛错——核销是主流程，结算登记由 T+1 job 兜底补登。
     */
    async registerFromBill(ctx, bill, saleOrderId) {
        var _a;
        try {
            const repo = this.connection.getRepository(ctx, coupon_settlement_order_entity_1.CouponSettlementOrder);
            const faceAmount = Math.max(0, Math.floor(Number(bill.discountAmount) || 0));
            const commissionRateBp = this.commissionRateBp();
            const { commissionAmount, netAmount } = (0, coupon_settlement_adapter_1.computeSettlementAmounts)(faceAmount, commissionRateBp);
            const row = new coupon_settlement_order_entity_1.CouponSettlementOrder({
                channelId: bill.channelId,
                saleOrderId: saleOrderId !== null && saleOrderId !== void 0 ? saleOrderId : null,
                customerCouponId: bill.customerCouponId,
                templateId: bill.couponTemplateId,
                redeemRef: `BILL:${bill.id}`,
                inStoreBillId: bill.id,
                faceAmount,
                commissionRateBp,
                commissionAmount,
                netAmount,
                status: 'PENDING',
                settlementNo: (0, coupon_settlement_adapter_1.buildSettlementNo)(bill.channelId, bill.customerCouponId),
                attempts: 0,
                remark: null,
            });
            await repo.save(row);
        }
        catch (e) {
            // 唯一约束冲突 = 已登记（重复核销回调/幂等重放），静默；其余错误记日志待 job 补登
            const msg = String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e);
            if (!/unique|duplicate|UNIQUE/i.test(msg)) {
                core_1.Logger.error(`Settlement registration failed for bill ${bill.id}: ${msg} (job will backfill)`, constants_1.loggerCtx);
            }
        }
    }
    /** T+1 汇总出单 + 提交分账 + 回执推进（供定时任务与 admin 手动触发共用；ctx 仅用于鉴权） */
    async runSettlementCycle() {
        const adapter = (0, coupon_settlement_adapter_1.resolveSettlementAdapter)();
        const backfilled = await this.backfillRegistrations();
        const submitted = await this.submitDueRows(adapter);
        const { promoted, failed } = await this.promoteSettledRows(adapter);
        if (backfilled > 0 || submitted > 0 || promoted > 0) {
            core_1.Logger.info(`Settlement cycle: backfill=${backfilled} submitted=${submitted} promoted=${promoted} failed=${failed}`, constants_1.loggerCtx);
        }
        return { submitted, promoted, failed };
    }
    /**
     * 兜底补登：核销成功但登记缺失（历史数据/登记异常）的到店买单 → 补 PENDING 结算单。
     * 查询条件全部下推 SQL（风险铁律②）：INNER JOIN 用户券限 saleOrderId 非空（只有出售券涉及分账），
     * LEFT JOIN 结算单排除已登记；日期用 TypeORM 参数绑定（Date 对象，驱动负责序列化，
     * SQLite/PG 口径一致——不做字符串手工比较，规避超时关单 e2e 的日期序列化前科）。
     */
    async backfillRegistrations() {
        var _a;
        const billRepo = this.connection.rawConnection.getRepository(in_store_bill_entity_1.InStoreBill);
        const settleRepo = this.connection.rawConnection.getRepository(coupon_settlement_order_entity_1.CouponSettlementOrder);
        const rows = await billRepo
            .createQueryBuilder('b')
            .select('b.id', 'billId')
            .addSelect('b.channelId', 'channelId')
            .addSelect('b.customerCouponId', 'customerCouponId')
            .addSelect('b.couponTemplateId', 'couponTemplateId')
            .addSelect('b.discountAmount', 'discountAmount')
            .addSelect('cc.saleOrderId', 'saleOrderId')
            .innerJoin(customer_coupon_entity_1.CustomerCoupon, 'cc', 'cc.id = b.customerCouponId AND cc.saleOrderId IS NOT NULL')
            .leftJoin(coupon_settlement_order_entity_1.CouponSettlementOrder, 's', 's.customerCouponId = b.customerCouponId')
            .where('s.id IS NULL')
            .andWhere('b.billedAt < :cutoff', { cutoff: this.settlementCutoff() })
            .orderBy('b.id', 'DESC')
            .take(CYCLE_BATCH)
            .getRawMany();
        let n = 0;
        for (const r of rows) {
            const billId = Number(r.billId);
            const channelId = Number(r.channelId);
            const customerCouponId = Number(r.customerCouponId);
            try {
                const faceAmount = Math.max(0, Math.floor(Number(r.discountAmount) || 0));
                const commissionRateBp = this.commissionRateBp();
                const { commissionAmount, netAmount } = (0, coupon_settlement_adapter_1.computeSettlementAmounts)(faceAmount, commissionRateBp);
                await settleRepo.save(new coupon_settlement_order_entity_1.CouponSettlementOrder({
                    channelId,
                    saleOrderId: r.saleOrderId == null ? null : Number(r.saleOrderId),
                    customerCouponId,
                    templateId: r.couponTemplateId == null ? null : Number(r.couponTemplateId),
                    redeemRef: `BILL:${billId}`,
                    inStoreBillId: billId,
                    faceAmount,
                    commissionRateBp,
                    commissionAmount,
                    netAmount,
                    status: 'PENDING',
                    settlementNo: (0, coupon_settlement_adapter_1.buildSettlementNo)(channelId, customerCouponId),
                    attempts: 0,
                }));
                n++;
            }
            catch (e) {
                if (!/unique|duplicate|UNIQUE/i.test(String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e))) {
                    core_1.Logger.error(`Settlement backfill insert failed (bill ${billId}, coupon ${customerCouponId}): ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
                }
            }
        }
        return n;
    }
    /**
     * 提交到期 PENDING 结算单（SQL 下推：status + T+1 界线 + 重试上限）。
     * 幂等：① submitSplit 幂等键 = 结算单号 ② 状态推进全部带原状态条件原子更新。
     */
    async submitDueRows(adapter) {
        var _a, _b, _c, _d, _e;
        const repo = this.connection.rawConnection.getRepository(coupon_settlement_order_entity_1.CouponSettlementOrder);
        const due = await repo
            .createQueryBuilder('s')
            .where('s.status = :status', { status: 'PENDING' })
            .andWhere('s.attempts < :max', {
            max: Math.max(1, Math.floor(Number((_a = process.env.COUPON_SETTLE_MAX_ATTEMPTS) !== null && _a !== void 0 ? _a : 8))),
        })
            .andWhere('s.createdAt < :cutoff', { cutoff: this.settlementCutoff() })
            .orderBy('s.id', 'ASC')
            .take(CYCLE_BATCH)
            .getMany();
        let submitted = 0;
        for (const row of due) {
            // 抢占：带原状态条件原子累加重试次数（并发双跑时受 settlementNo 幂等保护）
            const claim = await repo
                .createQueryBuilder()
                .update(coupon_settlement_order_entity_1.CouponSettlementOrder)
                .set({ attempts: () => 'attempts + 1' })
                .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                .execute();
            if (((_b = claim.affected) !== null && _b !== void 0 ? _b : 0) === 0)
                continue;
            try {
                const res = await adapter.submitSplit(row, row.settlementNo);
                if (res.accepted) {
                    await repo
                        .createQueryBuilder()
                        .update(coupon_settlement_order_entity_1.CouponSettlementOrder)
                        .set({
                        status: 'SETTLED',
                        settledAt: new Date(),
                        splitReceiptNo: (_c = res.receiptNo) !== null && _c !== void 0 ? _c : null,
                        splitMode: adapter.mode,
                        lastError: null,
                    })
                        .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                        .execute();
                    submitted++;
                }
                else {
                    await repo
                        .createQueryBuilder()
                        .update(coupon_settlement_order_entity_1.CouponSettlementOrder)
                        .set({ lastError: (_d = res.error) !== null && _d !== void 0 ? _d : 'split submit rejected' })
                        .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                        .execute();
                }
            }
            catch (e) {
                // 失败留在 PENDING（attempts 已累加）等待下轮重试
                await repo
                    .createQueryBuilder()
                    .update(coupon_settlement_order_entity_1.CouponSettlementOrder)
                    .set({ lastError: String((_e = e === null || e === void 0 ? void 0 : e.message) !== null && _e !== void 0 ? _e : e).slice(0, 2000) })
                    .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                    .execute()
                    .catch(() => undefined);
            }
        }
        return submitted;
    }
    /** 回执推进：SETTLED → PAID_OUT（FINISHED）/ 退回 PENDING 重试（FAILED） */
    async promoteSettledRows(adapter) {
        var _a, _b, _c, _d;
        const repo = this.connection.rawConnection.getRepository(coupon_settlement_order_entity_1.CouponSettlementOrder);
        const rows = await repo.find({ where: { status: 'SETTLED' }, order: { id: 'ASC' }, take: CYCLE_BATCH });
        let promoted = 0;
        let failed = 0;
        for (const row of rows) {
            if (!row.splitReceiptNo)
                continue;
            try {
                const receipt = await adapter.queryReceipt(row.splitReceiptNo);
                if (receipt.state === 'FINISHED') {
                    const upd = await repo
                        .createQueryBuilder()
                        .update(coupon_settlement_order_entity_1.CouponSettlementOrder)
                        .set({ status: 'PAID_OUT', paidOutAt: new Date(), lastError: null })
                        .where('id = :id AND status = :status', { id: row.id, status: 'SETTLED' })
                        .execute();
                    if (((_a = upd.affected) !== null && _a !== void 0 ? _a : 0) > 0)
                        promoted++;
                }
                else if (receipt.state === 'FAILED') {
                    const upd = await repo
                        .createQueryBuilder()
                        .update(coupon_settlement_order_entity_1.CouponSettlementOrder)
                        .set({ status: 'PENDING', lastError: (_b = receipt.error) !== null && _b !== void 0 ? _b : 'split receipt FAILED' })
                        .where('id = :id AND status = :status', { id: row.id, status: 'SETTLED' })
                        .execute();
                    if (((_c = upd.affected) !== null && _c !== void 0 ? _c : 0) > 0)
                        failed++;
                }
            }
            catch (e) {
                (_d = common_1.Logger.error) === null || _d === void 0 ? void 0 : _d.call(common_1.Logger, `[CouponSettlement] receipt query failed for ${row.settlementNo}: ${e === null || e === void 0 ? void 0 : e.message}`);
            }
        }
        return { promoted, failed };
    }
    /** admin 流水查询（渠道强制隔离） */
    async listSettlements(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, coupon_settlement_order_entity_1.CouponSettlementOrder)
            .createQueryBuilder('s')
            .where('s.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (options === null || options === void 0 ? void 0 : options.status) {
            qb.andWhere('s.status = :status', { status: options.status });
        }
        qb.orderBy('s.id', 'DESC');
        qb.skip(Math.max(0, (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0)).take(Math.min((_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findSettlement(ctx, id) {
        var _a;
        return ((_a = (await this.connection.getRepository(ctx, coupon_settlement_order_entity_1.CouponSettlementOrder).findOne({
            where: { id, channelId: ctx.channelId },
        }))) !== null && _a !== void 0 ? _a : undefined);
    }
    /** admin 手动触发（运维入口；鉴权在 resolver） */
    async manualRunCycle(ctx) {
        if (ctx.channelId == null) {
            throw new core_1.UserInputError('channel context required');
        }
        return this.runSettlementCycle();
    }
    /** 供退款联动（T8）预留的批量查询工具 */
    async findSettlementsBySaleOrder(ctx, saleOrderIds) {
        if (saleOrderIds.length === 0)
            return [];
        return this.connection.getRepository(ctx, coupon_settlement_order_entity_1.CouponSettlementOrder).find({ where: { saleOrderId: (0, typeorm_1.In)(saleOrderIds) } });
    }
};
exports.CouponSettlementService = CouponSettlementService;
exports.CouponSettlementService = CouponSettlementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], CouponSettlementService);
//# sourceMappingURL=coupon-settlement.service.js.map