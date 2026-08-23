import { RequestContext, TransactionalConnection } from '@vendure/core';
export declare class PaymentProfileMigrationService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 将档案级 installmentOptions 迁移到对应支付方式的 options */
    migrateLegacyInstallmentOptions(ctx: RequestContext): Promise<void>;
}
