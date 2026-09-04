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
exports.MerchantSettlementService = exports.COD_PAYMENT_CODES = void 0;
exports.merchantSettlementStatus = merchantSettlementStatus;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const timing_util_1 = require("./timing.util");
const order_box_service_1 = require("./order-box.service");
const merchant_settlement_ledger_entity_1 = require("./merchant-settlement-ledger.entity");
/**
 * 货到付款（COD）/门店收银支付方式 code 集合。
 *
 * 判定依据（仓库实测，见报告）：COD 支付处理器为 `payment/cod-handler.ts`，其 handler.code =
 * `cash-on-delivery`；默认数据播种 `seed/default-data.service.ts` 亦以 `CASHIER_PAYMENT_METHOD_CODE =
 * 'cash-on-delivery'` 创建支付方式。pickup-plugin `pickup.service.ts` 的到店收银集合同样以
 * `cash-on-delivery` 为首个元素。
 */
exports.COD_PAYMENT_CODES = ['cash-on-delivery'];
/**
 * 依据所选支付方式判定台账分账状态（纯函数）。
 * 命中 COD/到店收银 code 列表 → 'PENDING_SIGN'，否则 'PAID'。
 */
function merchantSettlementStatus(method, codPaymentCodes) {
    return codPaymentCodes.includes(method) ? 'PENDING_SIGN' : 'PAID';
}
/**
 * 商户分账台账服务：在结算拆单时，将一笔已结算订单按「商户（租户）」写入台账。
 * 采用 OrderBoxService.computeMerchantSplit 的分账口径（per tenant，合算该订单内各箱 subtotal）。
 */
let MerchantSettlementService = class MerchantSettlementService {
    constructor(orderBoxService, connection) {
        this.orderBoxService = orderBoxService;
        this.connection = connection;
    }
    /**
     * 为一笔已结算订单记录台账：每商户（租户）一行。
     *
     * 需在调用方同一事务内执行（@Transaction），以保证与订单结算原子一致——
     * TransactionalConnection.getRepository(ctx, ...) 会自动绑定到 ctx 的当前事务。
     *
     * @param opts.method 所选支付方式 code（用于 pagamento settleMethod 与 COD 判定）
     * @param opts.codPaymentCodes COD/货到付款支付方式 code 列表（命中则 status=PENDING_SIGN，否则 PAID）
     */
    async recordOrderSettlement(ctx, order, opts) {
        var _a;
        const t0 = (0, timing_util_1.perf)();
        const splits = await this.orderBoxService.computeMerchantSplit(ctx, order);
        core_1.Logger.info(`[timing] recordOrderSettlement#computeMerchantSplit order=${order.id} = ${(0, timing_util_1.perf)(t0)}ms`, constants_1.loggerCtx);
        const t1 = (0, timing_util_1.perf)();
        const repo = this.connection.getRepository(ctx, merchant_settlement_ledger_entity_1.MerchantSettlementLedger);
        for (const split of splits) {
            const status = merchantSettlementStatus(opts.method, opts.codPaymentCodes);
            const row = repo.create({
                orderId: String(order.id),
                tenantChannelId: String(split.tenantChannelId),
                tenantName: (_a = split.tenantName) !== null && _a !== void 0 ? _a : null,
                amount: Math.round(split.amount),
                settleMethod: opts.method,
                status,
                occurredAt: new Date(),
            });
            await repo.save(row);
        }
        core_1.Logger.info(`[timing] recordOrderSettlement#saveLedger order=${order.id} rows=${splits.length} = ${(0, timing_util_1.perf)(t1)}ms`, constants_1.loggerCtx);
    }
};
exports.MerchantSettlementService = MerchantSettlementService;
exports.MerchantSettlementService = MerchantSettlementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [order_box_service_1.OrderBoxService,
        core_1.TransactionalConnection])
], MerchantSettlementService);
//# sourceMappingURL=merchant-settlement.service.js.map