// P1-4 批次（2026-10-27）：云打印（飞鹅/易联云）+ 打印任务留痕。
// 生产 synchronize: false，启动幂等补列/建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/** 店铺级打印通道配置（campus_fulfillment_config） */
export const p8P1_4ConfigSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printProvider" varchar(16) NOT NULL DEFAULT 'local';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printAccount" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printDeviceSn" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printDeviceKey" varchar(128);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "printCopies" int NOT NULL DEFAULT 1;
`;

/** 打印任务留痕：每次云打印（含测试打印）落一条，排障/重打依据 */
export const p8P1_4PrintJobSql = `
CREATE TABLE IF NOT EXISTS campus_print_job (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "orderId" int, "channelId" int NOT NULL, provider varchar(16) NOT NULL, "deviceSn" varchar(64),
  status varchar(16) NOT NULL DEFAULT 'pending', "triggerType" varchar(16) NOT NULL,
  copies int NOT NULL DEFAULT 1, "dryRun" boolean NOT NULL DEFAULT false,
  "errorMessage" varchar(500), "durationMs" int, content text);
CREATE INDEX IF NOT EXISTS "IDX_campus_print_job_channel_created"
  ON campus_print_job ("channelId", "createdAt" DESC);
`;

@Injectable()
export class P8P1_4CloudPrintMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const sql of [p8P1_4ConfigSql, p8P1_4PrintJobSql]) {
                    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
                        await qr.query(statement);
                    }
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P8P1_4CloudPrintMigration] failed:', e?.message);
        }
    }
}
