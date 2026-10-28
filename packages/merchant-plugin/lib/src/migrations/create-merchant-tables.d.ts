import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare class CreateMerchantTablesMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    /** PG 没有 datetime 类型，sqlite 没有 timestamp，按当前连接选择 */
    private get dateColumnType();
    /** 原生 SQL 参数占位符：PG 用 $n，sqlite 用 ? */
    private ph;
    /** Table 列的 default 是原样拼接的 SQL，字符串字面量必须自带引号，否则 PG 会当作列引用 */
    private lit;
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
