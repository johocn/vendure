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
exports.CouponSettlementReconcileService = void 0;
exports.buildReconcileRunId = buildReconcileRunId;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const coupon_settlement_reconcile_1 = require("./coupon-settlement-reconcile");
const coupon_settlement_adapter_1 = require("./coupon-settlement-adapter");
const coupon_settlement_order_entity_1 = require("./coupon-settlement-order.entity");
const coupon_settlement_reconcile_diff_entity_1 = require("./coupon-settlement-reconcile-diff.entity");
const in_store_bill_entity_1 = require("./in-store-bill.entity");
/** 单轮对账扫描上限（与结算 job CYCLE_BATCH 同数量级，防一次性大事务） */
const RECONCILE_BATCH = 2000;
/** 单边缺失（缺结算单）差异落表上限：正常由结算 job 兜底补登自愈，超限只记汇总 */
const MISSING_SETTLEMENT_CAP = 100;
/** 对账轮次号：RCN-{channelId}-{yyyyMMddHHmmss} */
function buildReconcileRunId(channelId, now) {
    const p = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    return `RCN-${channelId}-${ts}`;
}
/**
 * 券结算对账服务（买单券资金流 T5）：
 * 三方口径 = 结算单（账内）↔ 分账回单（adapter.queryReceipt）↔ 商户核销流水（InStoreBill）。
 * - runReconcile：整渠道一轮对账，差异落 settlement_reconcile_diff；
 *   同渠道重跑先删上一轮未解决差异（对账语义 = 当前快照），resolved 记录保留审计。
 * - listDiffs / resolveDiff：台账页查询与人工核销差异。
 * 渠道隔离：与结算服务同口径，全部查询按 ctx.channelId 强制过滤。
 */
let CouponSettlementReconcileService = class CouponSettlementReconcileService {
    constructor(connection) {
        this.connection = connection;
        /** 临时容器：queryReceipt 异常跨两段传递（避免在 ②/③ 循环间重复结构） */
        this.pendingQueryFailed = new Map();
    }
    /** 一轮对账（admin 手动触发；定时接入见 plugin.ts，与结算 job 同先例） */
    async runReconcile(ctx) {
        var _a;
        const channelId = Number(ctx.channelId);
        if (!Number.isFinite(channelId)) {
            throw new core_1.UserInputError('channel context required');
        }
        const runId = buildReconcileRunId(channelId, new Date());
        const opts = (0, coupon_settlement_reconcile_1.resolveReconcileOpts)();
        const adapter = (0, coupon_settlement_adapter_1.resolveSettlementAdapter)();
        // ① 拉本渠道全部结算单（单轮上限内）
        const settleRepo = this.connection.rawConnection.getRepository(coupon_settlement_order_entity_1.CouponSettlementOrder);
        const rows = await settleRepo.find({
            where: { channelId },
            order: { id: 'ASC' },
            take: RECONCILE_BATCH,
        });
        // ② 分账回单核对（仅 SETTLED/PAID_OUT 且有回执号；查询异常落 RECEIPT_QUERY_FAILED 差异，下轮重试）
        const receipts = new Map();
        this.pendingQueryFailed.clear();
        for (const row of rows) {
            if ((row.status === 'SETTLED' || row.status === 'PAID_OUT') && row.splitReceiptNo) {
                const rid = Number(row.id);
                try {
                    receipts.set(rid, await adapter.queryReceipt(row.splitReceiptNo));
                }
                catch (e) {
                    // 查询失败与「回执 PROCESSING」语义不同：独立差异便于发现网关异常
                    this.pendingQueryFailed.set(rid, String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e).slice(0, 500));
                }
            }
        }
        // ③ 账内 + 回执差异（纯函数）
        const items = [];
        for (const row of rows) {
            const snap = toSnapshot(row);
            items.push(...(0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap, receipts.get(Number(row.id)), new Date(), opts));
            if (this.pendingQueryFailed.has(Number(row.id))) {
                items.push({
                    settlementOrderId: Number(row.id),
                    settlementNo: row.settlementNo,
                    diffType: 'RECEIPT_QUERY_FAILED',
                    severity: 'LOW',
                    detail: { splitReceiptNo: row.splitReceiptNo, error: this.pendingQueryFailed.get(Number(row.id)) },
                });
            }
        }
        this.pendingQueryFailed.clear();
        // ④ 单边缺失：结算单有但核销流水无（HIGH，数据完整性问题）
        for (const row of rows) {
            const miss = (0, coupon_settlement_reconcile_1.computeMissingBillDiff)(toSnapshot(row));
            if (miss) {
                const exists = await this.connection.rawConnection
                    .getRepository(in_store_bill_entity_1.InStoreBill)
                    .findOne({ where: { id: row.inStoreBillId } });
                if (!exists)
                    items.push(miss);
            }
        }
        // ⑤ 单边缺失：核销流水有但结算单无（MEDIUM：结算 job 兜底补登会自愈，持续存在说明补登失败）
        //    与 backfillRegistrations 同查询口径：INNER JOIN 出售券（saleOrderId 非空）+ LEFT JOIN 结算单排除已登记
        const cutoff = this.settlementCutoff();
        const orphanBills = await this.connection.rawConnection
            .getRepository(in_store_bill_entity_1.InStoreBill)
            .createQueryBuilder('b')
            .select('b.id', 'billId')
            .addSelect('b.customerCouponId', 'customerCouponId')
            .addSelect('b.discountAmount', 'discountAmount')
            .addSelect('cc.saleOrderId', 'saleOrderId')
            .innerJoin('CustomerCoupon', 'cc', 'cc.id = b.customerCouponId AND cc.saleOrderId IS NOT NULL')
            .leftJoin(coupon_settlement_order_entity_1.CouponSettlementOrder, 's', 's.customerCouponId = b.customerCouponId')
            .where('s.id IS NULL')
            .andWhere('b.billedAt < :cutoff', { cutoff })
            .orderBy('b.id', 'DESC')
            .take(MISSING_SETTLEMENT_CAP + 1)
            .getRawMany();
        for (const b of orphanBills.slice(0, MISSING_SETTLEMENT_CAP)) {
            items.push({
                settlementOrderId: null,
                settlementNo: null,
                diffType: 'MISSING_SETTLEMENT',
                severity: 'MEDIUM',
                detail: {
                    inStoreBillId: Number(b.billId),
                    customerCouponId: Number(b.customerCouponId),
                    discountAmount: b.discountAmount == null ? null : Number(b.discountAmount),
                    saleOrderId: b.saleOrderId == null ? null : Number(b.saleOrderId),
                    note: 'next settlement cycle will backfill; persists if backfill keeps failing',
                },
            });
        }
        // ⑥ 落表：同渠道重跑覆盖上一轮未解决差异（对账 = 当前快照语义），resolved 记录保留
        const diffRepo = this.connection.getRepository(ctx, coupon_settlement_reconcile_diff_entity_1.CouponSettlementReconcileDiff);
        await diffRepo
            .createQueryBuilder()
            .delete()
            .where('channelId = :channelId AND resolvedAt IS NULL', { channelId })
            .execute();
        if (items.length > 0) {
            await diffRepo.save(items.map(d => diffRepo.create({
                runId,
                channelId,
                settlementOrderId: d.settlementOrderId,
                settlementNo: d.settlementNo,
                diffType: d.diffType,
                severity: d.severity,
                detail: JSON.stringify(d.detail),
            })));
        }
        const bySeverity = (0, coupon_settlement_reconcile_1.summarizeSeverities)(items);
        core_1.Logger.info(`Settlement reconcile run ${runId}: checked=${rows.length} diffs=${items.length} high=${bySeverity.high} medium=${bySeverity.medium} low=${bySeverity.low}`, constants_1.loggerCtx);
        return Object.assign({ runId, checked: rows.length, diffs: items.length }, bySeverity);
    }
    /** 台账页差异查询（渠道强制隔离；默认只看未解决） */
    async listDiffs(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, coupon_settlement_reconcile_diff_entity_1.CouponSettlementReconcileDiff)
            .createQueryBuilder('d')
            .where('d.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (!(options === null || options === void 0 ? void 0 : options.includeResolved)) {
            qb.andWhere('d.resolvedAt IS NULL');
        }
        if (options === null || options === void 0 ? void 0 : options.severity) {
            qb.andWhere('d.severity = :severity', { severity: options.severity });
        }
        if (options === null || options === void 0 ? void 0 : options.diffType) {
            qb.andWhere('d.diffType = :diffType', { diffType: options.diffType });
        }
        qb.orderBy('d.id', 'DESC');
        qb.skip(Math.max(0, (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0)).take(Math.min((_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    /** 人工核销差异（处理完成后标记，保留审计） */
    async resolveDiff(ctx, id, remark) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, coupon_settlement_reconcile_diff_entity_1.CouponSettlementReconcileDiff);
        const upd = await repo
            .createQueryBuilder()
            .update(coupon_settlement_reconcile_diff_entity_1.CouponSettlementReconcileDiff)
            .set({ resolvedAt: new Date(), remark: (_a = remark === null || remark === void 0 ? void 0 : remark.slice(0, 200)) !== null && _a !== void 0 ? _a : null })
            .where('id = :id AND channelId = :channelId AND resolvedAt IS NULL', {
            id,
            channelId: Number(ctx.channelId),
        })
            .execute();
        return ((_b = upd.affected) !== null && _b !== void 0 ? _b : 0) > 0;
    }
    /** T+1 界线：今天零点（与结算 job 同口径） */
    settlementCutoff() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
};
exports.CouponSettlementReconcileService = CouponSettlementReconcileService;
exports.CouponSettlementReconcileService = CouponSettlementReconcileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], CouponSettlementReconcileService);
function toSnapshot(row) {
    return {
        id: Number(row.id),
        settlementNo: row.settlementNo,
        status: row.status,
        splitReceiptNo: row.splitReceiptNo,
        faceAmount: row.faceAmount,
        commissionAmount: row.commissionAmount,
        netAmount: row.netAmount,
        settledAt: row.settledAt,
        attempts: row.attempts,
        lastError: row.lastError,
        inStoreBillId: row.inStoreBillId,
    };
}
//# sourceMappingURL=coupon-settlement-reconcile.service.js.map