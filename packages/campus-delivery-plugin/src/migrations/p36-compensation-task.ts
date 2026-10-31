// R2 补偿任务表：券/站内信失败落库 + 定时退避重试。
// 物理列名规则：属性名直接作为列名（camelCase 需双引号）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p36CompensationTaskSql = `
CREATE TABLE IF NOT EXISTS campus_compensation_task (
    id serial PRIMARY KEY,
    "orderId" int NOT NULL,
    "channelId" int NOT NULL,
    "customerId" int,
    kind varchar NOT NULL,
    payload text,
    "dedupeKey" varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'pending',
    attempts int NOT NULL DEFAULT 0,
    "nextAttemptAt" timestamp,
    "lastError" varchar,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_campus_compensation_dedupe" ON campus_compensation_task ("dedupeKey");
CREATE INDEX IF NOT EXISTS "IDX_campus_compensation_due" ON campus_compensation_task (status, "nextAttemptAt");
`;

@Injectable()
export class P36CompensationTaskMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p36CompensationTaskSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(`${statement};`);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P36CompensationTaskMigration] failed:', e?.message);
        }
    }
}
