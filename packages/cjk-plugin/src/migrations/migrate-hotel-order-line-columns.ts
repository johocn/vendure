// 确保 order_line 表存在酒店订单行自定义字段列（入住/离店/晚数）。
// Vendure 自定义字段列名规则 = customFields + 首字母大写字段名，其余小写：
//   hotelCheckIn → customFieldsHotelcheckin
//   hotelCheckOut → customFieldsHotelcheckout
//   hotelNights → customFieldsHotelnights
// 生产（PostgreSQL）与本地开发（SQLite）均可能关闭 synchronize，故此 migration 幂等地补列；
// 失败仅 console.error，不阻塞启动。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class HotelOrderLineColumnMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata('OrderLine').tableName;
            const qr = this.connection.createQueryRunner();
            try {
                const ensure = async (name: string, type: string) => {
                    if (!(await qr.hasColumn(tableName, name))) {
                        await qr.addColumn(tableName, new TableColumn({ name, type, isNullable: true }));
                        // eslint-disable-next-line no-console
                        console.log(`[HotelOrderLineColumnMigration] added ${tableName}.${name}`);
                    }
                };
                await ensure('customFieldsHotelcheckin', 'varchar(255)');
                await ensure('customFieldsHotelcheckout', 'varchar(255)');
                await ensure('customFieldsHotelnights', 'integer');
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[HotelOrderLineColumnMigration] failed to ensure columns:', e?.message);
        }
    }
}