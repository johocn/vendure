// 幂等补 hotel_booking P4 Task 15 改期列：
// - rescheduleCount：已使用改期次数（int，default 0）
// - rescheduledAt：最近改期时间
// - reschedulePendingJson：待支付补差的改期意向（text）
// 生产（PostgreSQL）与本地（SQLite）均可能关闭 synchronize，启动期幂等补列；失败仅告警不阻塞。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

import { HotelBooking } from '../hotel/booking/booking.entity';

@Injectable()
export class HotelBookingRescheduleColumnsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata(HotelBooking).tableName;
            const qr = this.connection.createQueryRunner();
            try {
                const specs: Array<{ name: string; type: string; isNullable: boolean; default?: string }> = [
                    { name: 'rescheduleCount', type: 'integer', isNullable: false, default: '0' },
                    { name: 'rescheduledAt', type: 'timestamp', isNullable: true },
                    { name: 'reschedulePendingJson', type: 'text', isNullable: true },
                ];
                for (const spec of specs) {
                    if (!(await qr.hasColumn(tableName, spec.name))) {
                        await qr.addColumn(
                            tableName,
                            new TableColumn({
                                name: spec.name,
                                type: spec.type,
                                isNullable: spec.isNullable,
                                default: spec.default,
                            }),
                        );
                        // eslint-disable-next-line no-console
                        console.log(`[HotelBookingRescheduleColumnsMigration] added ${tableName}.${spec.name}`);
                    }
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[HotelBookingRescheduleColumnsMigration] failed to ensure columns:', e?.message);
        }
    }
}
