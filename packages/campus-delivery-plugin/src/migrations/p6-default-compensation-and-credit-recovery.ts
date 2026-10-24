// P6 运营默认值 + 骑手信用自动恢复（2026-10-24）
// - 超时赔付默认开（entity default 已改 true；这里把已有 false 行也翻成 true）
// - 缺券模板时 sweepTimeoutCompensation 已有限频告警（L796-804）
// - 骑手信用自动恢复由 RiderCreditService.sweepRecovery() 实现（每轮 dispatch sweep 调用）
//
// 一次性语义：本类挂 OnApplicationBootstrap 每次启动都会跑，数据翻写必须只执行一次，
// 否则运营在后台关掉超时赔付后，下次重启/部署会被再翻回 TRUE（自动发券=真金白银）。
// 用 marker 表先抢占任务名，抢到才执行 UPDATE，之后永不再跑。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const P6_MARKER = 'p6-default-compensation';

export const p6ClaimSql = `
CREATE TABLE IF NOT EXISTS campus_migration_marker (
  name varchar(255) PRIMARY KEY, "appliedAt" timestamptz DEFAULT now());
INSERT INTO campus_migration_marker(name) VALUES ('${P6_MARKER}')
ON CONFLICT (name) DO NOTHING
RETURNING name;
`;

export const p6DefaultCompensationSql = `
-- 超时赔付默认开：entity default 已改 true，这里把已有 FALSE 行翻成 TRUE
-- 缺券模板时 sweepTimeoutCompensation 会限频告警，不会实际赔付
UPDATE campus_fulfillment_config
SET "timeoutCompensationEnabled" = TRUE
WHERE "timeoutCompensationEnabled" = FALSE;
`;

@Injectable()
export class P6DefaultCompensationMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                const claimed: any = await qr.query(p6ClaimSql);
                const rows = Array.isArray(claimed) && Array.isArray(claimed[0]) ? claimed[0] : claimed;
                // 未抢到 marker = 已执行过（运营后续的关闭要保留），直接跳过
                if (!Array.isArray(rows) || !rows.length) return;
                await qr.query(p6DefaultCompensationSql);
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P6DefaultCompensationMigration] failed:', e?.message);
        }
    }
}
