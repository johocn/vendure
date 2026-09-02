import { Injectable } from '@nestjs/common';
import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { OrderBoxService } from './order-box.service';
import { MerchantSettlementLedger } from './merchant-settlement-ledger.entity';

/**
 * 货到付款（COD）/门店收银支付方式 code 集合。
 *
 * 判定依据（仓库实测，见报告）：COD 支付处理器为 `payment/cod-handler.ts`，其 handler.code =
 * `cash-on-delivery`；默认数据播种 `seed/default-data.service.ts` 亦以 `CASHIER_PAYMENT_METHOD_CODE =
 * 'cash-on-delivery'` 创建支付方式。pickup-plugin `pickup.service.ts` 的到店收银集合同样以
 * `cash-on-delivery` 为首个元素。
 */
export const COD_PAYMENT_CODES: ReadonlyArray<string> = ['cash-on-delivery'];

/** 台账分账状态类型：在线支付在结算即已收款（PAID），COD 待签收（PENDING_SIGN）。 */
export type MerchantSettlementStatus = 'PAID' | 'PENDING_SIGN';

/**
 * 依据所选支付方式判定台账分账状态（纯函数）。
 * 命中 COD/到店收银 code 列表 → 'PENDING_SIGN'，否则 'PAID'。
 */
export function merchantSettlementStatus(
    method: string,
    codPaymentCodes: ReadonlyArray<string>,
): MerchantSettlementStatus {
    return codPaymentCodes.includes(method) ? 'PENDING_SIGN' : 'PAID';
}

/**
 * 商户分账台账服务：在结算拆单时，将一笔已结算订单按「商户（租户）」写入台账。
 * 采用 OrderBoxService.computeMerchantSplit 的分账口径（per tenant，合算该订单内各箱 subtotal）。
 */
@Injectable()
export class MerchantSettlementService {
    constructor(
        private orderBoxService: OrderBoxService,
        private connection: TransactionalConnection,
    ) {}

    /**
     * 为一笔已结算订单记录台账：每商户（租户）一行。
     *
     * 需在调用方同一事务内执行（@Transaction），以保证与订单结算原子一致——
     * TransactionalConnection.getRepository(ctx, ...) 会自动绑定到 ctx 的当前事务。
     *
     * @param opts.method 所选支付方式 code（用于 pagamento settleMethod 与 COD 判定）
     * @param opts.codPaymentCodes COD/货到付款支付方式 code 列表（命中则 status=PENDING_SIGN，否则 PAID）
     */
    async recordOrderSettlement(
        ctx: RequestContext,
        order: Order,
        opts: { method: string; codPaymentCodes: string[] },
    ): Promise<void> {
        const splits = await this.orderBoxService.computeMerchantSplit(ctx, order);

        const repo = this.connection.getRepository(ctx, MerchantSettlementLedger);
        for (const split of splits) {
            const status: MerchantSettlementStatus = merchantSettlementStatus(opts.method, opts.codPaymentCodes);
            const row = repo.create({
                orderId: String(order.id),
                tenantChannelId: String(split.tenantChannelId as ID),
                tenantName: split.tenantName ?? null,
                amount: Math.round(split.amount),
                settleMethod: opts.method,
                status,
                occurredAt: new Date(),
            });
            await repo.save(row);
        }
    }
}