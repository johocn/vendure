// §66（2026-10-28）：沽清次日自动恢复。
// 生产 synchronize: false，启动幂等建表/补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p11SoldOutAutoRestoreSql = `
CREATE TABLE IF NOT EXISTS campus_soldout_batch (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "productId" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_soldout_batch_channel_product
  ON campus_soldout_batch ("channelId", "productId");
ALTER TABLE channel ADD COLUMN IF NOT EXISTS "customFieldsWaimaisoldoutautorestore" boolean DEFAULT true;
`;

@Injectable()
export class P11SoldOutAutoRestoreMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p11SoldOutAutoRestoreSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P11SoldOutAutoRestoreMigration] failed:', e?.message);
        }
    }
}
