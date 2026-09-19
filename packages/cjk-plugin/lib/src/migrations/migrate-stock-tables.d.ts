import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/**
 * 幂等补建 4 张库存表。列与实体 field 完全对齐（含 unique / 索引 / 默认值）。
 */
export declare class StockTableMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
/**
 * 幂等补 Channel 的 3 个库存模式/odoo 自定义字段列。
 */
export declare class ChannelInventoryModeColumnMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
