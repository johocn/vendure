// 幂等补 channel.reservationTtlMinutes 自定义字段列。
// Vendure 命名规则：customFields + 首字母大写字段名、其余小写 → customFieldsReservationttlminutes
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class ReservationTtlColumnMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata('Channel').tableName;
            const COL = 'customFieldsReservationttlminutes';
            const runner = this.connection.createQueryRunner();
            try {
                if (!(await runner.hasColumn(tableName, COL))) {
                    await runner.addColumn(
                        tableName,
                        new TableColumn({ name: COL, type: 'int', isNullable: true }),
                    );
                    // eslint-disable-next-line no-console
                    console.log(`[ReservationTtlColumnMigration] added ${tableName}.${COL}`);
                }
            } finally {
                await runner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[ReservationTtlColumnMigration] failed to ensure column:', e?.message);
        }
    }
}