import { RequestContext, TransactionalConnection } from '@vendure/core';
import { MerchantSettlementLedger } from './merchant-settlement-ledger.entity';
/**
 * 商户分账台账管理端查询（web-admin 后续使用）。
 * 仅做只读查询，不在此处执行任何写入。
 */
export declare class MerchantSettlementAdminResolver {
    private connection;
    constructor(connection: TransactionalConnection);
    merchantSettlementLedgers(ctx: RequestContext, orderId?: string): Promise<MerchantSettlementLedger[]>;
}
