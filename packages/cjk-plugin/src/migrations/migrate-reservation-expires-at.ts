// 幂等补 stock_reservation.expiresAt 列（生产 Postgres 关闭 synchronize，必须显式补列）。
// 列名不硬编码：从 TypeORM 元数据取 databaseName，避免 dev(sqlite) / prod(postgres) 命名策略差异。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';
import { StockReservationEntity } from '../inventory/stock-reservation.entity';

@Injectable()
export class ReservationExpiresAtMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const meta = this.connection.getMetadata(StockReservationEntity);
            const tableName = meta.tableName;
            const property = meta.columns.find(c => c.propertyName === 'expiresAt');
            const columnName = property?.databaseName ?? 'expiresAt';
            const runner = this.connection.createQueryRunner();
            try {
                if (!(await runner.hasColumn(tableName, columnName))) {
                    await runner.addColumn(
                        tableName,
                        new TableColumn({ name: columnName, type: 'timestamp', isNullable: true }),
                    );
                    // eslint-disable-next-line no-console
                    console.log(`[ReservationExpiresAtMigration] added ${tableName}.${columnName}`);
                }
            } finally {
                await runner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，下次启动重试（与既有 migration 一致）
            // eslint-disable-next-line no-console
            console.error('[ReservationExpiresAtMigration] failed to ensure column:', e?.message);
        }
    }
}