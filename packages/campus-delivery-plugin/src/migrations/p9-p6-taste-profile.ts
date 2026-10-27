// P3 批次（2026-10-27）：口味偏好云端同步列。
// Customer 自定义字段为物理列（customFields + 首字母大写+其余小写）；
// DB_SYNC=0 时靠此处幂等补列，IF NOT EXISTS 重复启动安全。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p9P6TasteProfileSql = `
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsTasteprofile" text
`;

@Injectable()
export class P9P6TasteProfileMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p9P6TasteProfileSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P9P6TasteProfileMigration] failed:', e?.message);
        }
    }
}
