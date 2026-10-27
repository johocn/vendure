// P2-4 批次（2026-10-27）：智能取餐柜站点 + 无人配送通道配置（接口占位）。
// 生产 synchronize: false，启动幂等建表/补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p9P4LockerSql = `
CREATE TABLE IF NOT EXISTS campus_locker_station (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, name varchar(64) NOT NULL, location varchar(255) NOT NULL,
  provider varchar(32) NOT NULL DEFAULT 'self', "totalCells" int NOT NULL DEFAULT 0,
  "availableCells" int NOT NULL DEFAULT 0, "openHours" varchar(32), "pickupGuide" text,
  enabled boolean NOT NULL DEFAULT true, sort int NOT NULL DEFAULT 0, "createdBy" varchar(255));
CREATE INDEX IF NOT EXISTS idx_campus_locker_channel ON campus_locker_station ("channelId", enabled);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryProvider" varchar(16) NOT NULL DEFAULT 'mock';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryEndpoint" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "unmannedDeliveryKey" varchar(128)
`;

@Injectable()
export class P9P4LockerMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p9P4LockerSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P9P4LockerMigration] failed:', e?.message);
        }
    }
}
