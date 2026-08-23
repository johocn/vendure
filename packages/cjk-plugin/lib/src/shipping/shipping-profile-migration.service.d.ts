import { RequestContext, TransactionalConnection } from '@vendure/core';
export declare class ShippingProfileMigrationService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 将档案级 pickupLocations 迁移到对应自提方式的 options.pickupLocationIds */
    migrateLegacyPickupLocations(ctx: RequestContext): Promise<void>;
}
