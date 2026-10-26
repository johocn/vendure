import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare class CreateMerchantTablesMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
    private ensureTables;
    /** 表已存在（或建表后）补齐缺失索引（按列集合去重，避免 synchronize 已建同名索引时重复创建） */
    private ensureIndexes;
    private quote;
    private ensurePickupLocationColumn;
    /** 历史自提点（type=store）→ Merchant + MerchantStore + pickup_location.merchantStoreId 回填 */
    private backfillPickupStores;
    /** 校园履约配置（有 storeAddress / storePhone）→ 每渠道一个门店并 upsert 认领关系 */
    private backfillCampusStores;
}
