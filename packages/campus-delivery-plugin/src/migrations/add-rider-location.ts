// P8-4 骑手轨迹留存（2026-10-25）：实时位置原先只写在 order.customFields（送达即清空），
// 无法事后追溯配送路线。新增 campus_rider_location 历史表（配送中每 10s 一条，30 天清理）。
// 同时为分成台账补两个具名索引（后台按渠道/骑手倒序分页查询）。
// 生产 synchronize: false，启动幂等建表/建索引（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const addRiderLocationSql = `
CREATE TABLE IF NOT EXISTS campus_rider_location (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL,
  "orderId" int NOT NULL,
  "riderCustomerId" int NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  "reportedAt" timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campus_rider_location_order ON campus_rider_location ("orderId", "reportedAt");
CREATE INDEX IF NOT EXISTS idx_campus_rider_location_rider ON campus_rider_location ("channelId", "riderCustomerId", "reportedAt");
CREATE INDEX IF NOT EXISTS idx_campus_rider_earning_channel_created ON rider_earning ("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_campus_rider_earning_rider_created ON rider_earning ("riderCustomerId", "createdAt");
`;

@Injectable()
export class AddRiderLocationMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                const statements = addRiderLocationSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean);
                for (const statement of statements) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[AddRiderLocationMigration] failed:', e?.message);
        }
    }
}
