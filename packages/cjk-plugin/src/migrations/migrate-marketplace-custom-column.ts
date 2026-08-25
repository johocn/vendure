import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

/**
 * 幂等补列：为 Product 新增 marketplace 审批列、Channel 新增 merchantStatus 列。
 * 生产关闭 synchronize 时用 queryRunner 幂等补列，失败仅打日志不阻塞启动。
 */
@Injectable()
export class MarketplaceCustomColumnMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    // 列名规则：customFields + 首字母大写字段名（Vendure 全小写）
    private readonly productColumns: Array<{ col: string; type: string }> = [
        { col: 'customFieldsListedinmarketplace', type: 'boolean' },
        { col: 'customFieldsMarketplacestatus', type: 'varchar(32)' },
        { col: 'customFieldsMerchantref', type: 'varchar(255)' },
        { col: 'customFieldsRejectreason', type: 'varchar(500)' },
    ];
    private readonly channelColumn = { col: 'customFieldsMerchantstatus', type: 'varchar(32)' };

    async onApplicationBootstrap() {
        try {
            const productTable = this.connection.getMetadata('Product').tableName;
            const channelTable = this.connection.getMetadata('Channel').tableName;
            const qr = this.connection.createQueryRunner();
            try {
                for (const c of this.productColumns) {
                    if (!(await qr.hasColumn(productTable, c.col))) {
                        await qr.addColumn(productTable, new TableColumn({ name: c.col, type: c.type, isNullable: true, default: c.type === 'boolean' ? false : undefined }));
                    }
                }
                if (!(await qr.hasColumn(channelTable, this.channelColumn.col))) {
                    await qr.addColumn(channelTable, new TableColumn({ name: this.channelColumn.col, type: this.channelColumn.type, isNullable: true }));
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[MarketplaceCustomColumnMigration] failed to ensure columns:', e?.message);
        }
    }
}