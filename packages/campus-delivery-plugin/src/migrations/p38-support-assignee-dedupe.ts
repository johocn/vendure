// G3 系统工单自动指派值班人：工单增加 assigneeId（管理员 userId）。
// M4 跨实例去重/限频：新建 campus_dedupe_key（key 主键，expiresAt 到期时间，counter 计数，value JSON）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p38SupportAssigneeDedupeSql = `
ALTER TABLE campus_support_ticket
    ADD COLUMN IF NOT EXISTS "assigneeId" int;
CREATE INDEX IF NOT EXISTS "IDX_campus_support_ticket_assignee"
    ON campus_support_ticket ("assigneeId") WHERE "assigneeId" IS NOT NULL;
CREATE TABLE IF NOT EXISTS campus_dedupe_key (
    "key" varchar PRIMARY KEY,
    "expiresAt" timestamptz NOT NULL,
    counter int NOT NULL DEFAULT 0,
    value jsonb
);
CREATE INDEX IF NOT EXISTS "IDX_campus_dedupe_key_expires"
    ON campus_dedupe_key ("expiresAt");
`;

@Injectable()
export class P38SupportAssigneeDedupeMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p38SupportAssigneeDedupeSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P38SupportAssigneeDedupeMigration] failed:', e?.message);
        }
    }
}
