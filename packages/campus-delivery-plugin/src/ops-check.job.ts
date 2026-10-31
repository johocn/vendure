import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { campusDayKey } from './campus-time';
import { campusHhmm } from './feishu/feishu.digest.service';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
import { PeriodicFallback } from './periodic-fallback';

interface CheckMetric {
    label: string;
    count: number;
}

/**
 * R8 遗留巡检（默认每日 09:00，UTC+8）：把「会静默卡住」的残留量汇总推送到平台群。
 * 全部指标为只读 COUNT；任一查询失败记为 -1 并跳过该项，不影响其余指标。
 * 多实例安全：PG advisory lock + 进程内按天去重（与飞书汇总同模式）。
 */
@Injectable()
export class OpsCheckJob implements OnApplicationShutdown {
    private fallback: PeriodicFallback | null = null;
    private sentDay: string | null = null;
    /** 巡检时间（HH:mm，UTC+8），默认 09:00 */
    private readonly at = process.env.CAMPUS_OPS_CHECK_AT || '09:00';

    constructor(
        private connection: TransactionalConnection,
        private feishu: FeishuNotifyService,
    ) {}

    start(intervalMs = 30 * 60_000): void {
        if (this.fallback) return;
        this.fallback = new PeriodicFallback({ name: 'ops-check', intervalMs, loggerCtx: 'CampusOpsCheck' });
        this.fallback.start(async () => {
            await this.runOnce();
        });
    }

    onApplicationShutdown(): void {
        this.fallback?.stop();
        this.fallback = null;
    }

    /** 执行一次巡检；已过巡检时间且当日未发送时推送，返回推送文本（未触发/全为零返回 null） */
    async runOnce(now = Date.now()): Promise<string | null> {
        if (campusHhmm(now) < this.at) return null;
        const day = campusDayKey(now);
        if (this.sentDay === day) return null;

        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:ops-check:${day}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) return null; // 其他实例正在/已执行
            try {
                if (this.sentDay === day) return null;
                const metrics = await this.collect();
                const abnormal = metrics.filter(m => m.count > 0);
                this.sentDay = day;
                if (!abnormal.length) return null;
                const text = `遗留巡检 ${day}\n${abnormal.map(m => `${m.label}：${m.count}`).join('\n')}`;
                await this.feishu.pushEvent('alert', `遗留巡检 ${day}`, text, undefined, `ops_check:${day}`);
                return text;
            } finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
            }
        } finally {
            await runner.release();
        }
    }

    private async collect(): Promise<CheckMetric[]> {
        const count = async (sql: string): Promise<number> => {
            try {
                const r: any = await this.connection.rawConnection.query(sql);
                const n = Array.isArray(r) && Array.isArray(r[0]) ? r[0][0]?.n : r?.[0]?.n;
                return Number(n ?? 0);
            } catch (e: any) {
                Logger.warn(`巡检查询失败：${e?.message ?? e}`, 'CampusOpsCheck');
                return -1;
            }
        };
        const [withdraw, refund, thirdParty, compFailed, compOverdue] = await Promise.all([
            count(
                `SELECT COUNT(*)::int AS n FROM rider_withdrawal_request
                 WHERE "withdrawState" = 'intent' AND "createdAt" < now() - interval '10 minutes'`,
            ),
            count(`SELECT COUNT(*)::int AS n FROM "order" WHERE "customFieldsHallstatus" = 'refund_failed'`),
            count(`SELECT COUNT(*)::int AS n FROM "order" WHERE "customFieldsThirdpartystate" = 'exception'`),
            count(`SELECT COUNT(*)::int AS n FROM campus_compensation_task WHERE status = 'failed'`),
            count(
                `SELECT COUNT(*)::int AS n FROM campus_compensation_task
                 WHERE status = 'pending' AND "nextAttemptAt" < now() - interval '30 minutes'`,
            ),
        ]);
        return [
            { label: '提现扣款意图滞留', count: withdraw },
            { label: '退款失败待人工', count: refund },
            { label: '外部运力异常', count: thirdParty },
            { label: '补偿任务失败', count: compFailed },
            { label: '补偿任务超期未执行', count: compOverdue },
        ];
    }
}
