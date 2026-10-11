// 幂等补 hotel_booking P4 取消退款列：
// - cancelFeeCent：实际扣款快照（分）
// - afterSalesRequestId：关联售后单（逾时部分退款审批链 + 幂等去重）
// 生产（PostgreSQL）与本地（SQLite）均可能关闭 synchronize，启动期幂等补列；失败仅告警不阻塞。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

import { HotelBooking } from '../hotel/booking/booking.entity';

@Injectable()
export class HotelBookingCancelColumnsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata(HotelBooking).tableName;
            const qr = this.connection.createQueryRunner();
            try {
                for (const name of ['cancelFeeCent', 'afterSalesRequestId']) {
                    if (!(await qr.hasColumn(tableName, name))) {
                        await qr.addColumn(
                            tableName,
                            new TableColumn({ name, type: 'integer', isNullable: true }),
                        );
                        // eslint-disable-next-line no-console
                        console.log(`[HotelBookingCancelColumnsMigration] added ${tableName}.${name}`);
                    }
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[HotelBookingCancelColumnsMigration] failed to ensure columns:', e?.message);
        }
    }
}
