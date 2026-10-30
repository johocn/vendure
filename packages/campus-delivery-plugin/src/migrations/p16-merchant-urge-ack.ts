// §78（2026-10-30）：顾客催单商家侧闭环。
// 「商家已知晓」落独立小表（order 只存顾客侧 urged/urgedAt，不新增 order 列，避免 schema sync 并发加列）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p16MerchantUrgeAckSql = `
CREATE TABLE IF NOT EXISTS campus_urge_ack (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "orderId" integer NOT NULL,
  "ackedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_urge_ack_channel_order
  ON campus_urge_ack ("channelId", "orderId");
`;

@Injectable()
export class P16MerchantUrgeAckMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p16MerchantUrgeAckSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P16MerchantUrgeAckMigration] failed:', e?.message);
        }
    }
}
