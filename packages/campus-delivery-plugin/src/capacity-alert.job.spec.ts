// 运力预警：分级告警 / 店铺定向 / 升级绕过冷却 / 失败不占冷却 / 恢复通知 / 阈值解析
import { describe, expect, it, vi } from 'vitest';
import { CapacityAlertJob, capacityOpsLink, readCapacityAlertSettings, type BacklogStat } from './capacity-alert.job';

function mkJob(opts: {
    channels?: any[];
    riders?: Record<number, number>;
    backlog?: Record<number, BacklogStat>;
    delivered?: boolean;
    enabled?: boolean;
    settings?: Record<string, any>;
}) {
    const query = vi.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM campus_fulfillment_config')) return opts.channels ?? [];
        if (sql.includes('FROM customer c')) return [{ n: opts.riders?.[params[0]] ?? 0 }];
        if (sql.includes('FROM "order" o')) {
            const b = opts.backlog?.[params[0]] ?? { count: 0, oldestMinutes: 0 };
            const oldest = b.oldestMinutes > 0 ? new Date(Date.now() - b.oldestMinutes * 60_000).toISOString() : null;
            return [{ n: b.count, oldest }];
        }
        return [];
    });
    const conn = { rawConnection: { query } } as any;
    const feishu = {
        enabled: opts.enabled ?? true,
        pushEvent: vi.fn(async () => opts.delivered ?? true),
    } as any;
    const job = new CapacityAlertJob(conn, feishu);
    job.configure({
        enabled: true,
        cooldownMs: 30 * 60_000,
        noRiderBacklog: 1,
        tightBacklog: 5,
        tightRiders: 2,
        atAll: true,
        channels: [],
        ...(opts.settings ?? {}),
    });
    return { job, feishu };
}

const A = { id: 113, code: 'canteen-a', shopname: '一食堂' };
const B = { id: 114, code: 'canteen-b', shopname: '' };

describe('CapacityAlertJob', () => {
    it('无在线骑手 → 严重告警：带店铺名/单量/等待时长/看板链接，并 @所有人', async () => {
        const { job, feishu } = mkJob({
            channels: [A],
            riders: { 113: 0 },
            backlog: { 113: { count: 3, oldestMinutes: 12 } },
        });
        await job.run();
        expect(feishu.pushEvent).toHaveBeenCalledTimes(1);
        const [scene, title, content, orderCode, key, target] = (feishu.pushEvent as any).mock.calls[0];
        expect(scene).toBe('alert');
        expect(title).toBe('运力告警：无在线骑手');
        expect(content).toContain('店铺 一食堂（canteen-a）');
        expect(content).toContain('待抢订单 3 单（最久已等待 12 分钟）');
        expect(content).toContain('调度看板：');
        expect(orderCode).toBeUndefined();
        expect(key).toContain('capacity-alert:113:critical:');
        expect(target).toEqual({ channel: 'canteen-a', atAll: true });
    });

    it('骑手紧张 → 普通告警（不 @所有人，店铺名缺失回退渠道 code）', async () => {
        const { job, feishu } = mkJob({
            channels: [B],
            riders: { 114: 2 },
            backlog: { 114: { count: 5, oldestMinutes: 0 } },
        });
        await job.run();
        const [, title, content, , , target] = (feishu.pushEvent as any).mock.calls[0];
        expect(title).toBe('运力告警：骑手紧张');
        expect(content).toContain('店铺 canteen-b（canteen-b）');
        expect(content).toContain('在线骑手仅 2 人');
        expect(target).toEqual({ channel: 'canteen-b', atAll: false });
    });

    it('健康渠道不推；同级别冷却期内不重复推', async () => {
        const { job, feishu } = mkJob({
            channels: [A, B],
            riders: { 113: 0, 114: 3 },
            backlog: { 113: { count: 1, oldestMinutes: 5 }, 114: { count: 0, oldestMinutes: 0 } },
        });
        await job.run();
        await job.run();
        expect(feishu.pushEvent).toHaveBeenCalledTimes(1);
    });

    it('级别升级（紧张→无骑手）绕过冷却立即推送', async () => {
        const state = { riders: 2 };
        const { job, feishu } = mkJob({
            channels: [A],
            backlog: { 113: { count: 5, oldestMinutes: 3 } },
        });
        (job as any).connection = {
            rawConnection: {
                query: vi.fn(async (sql: string, params: any[] = []) => {
                    if (sql.includes('FROM campus_fulfillment_config')) return [A];
                    if (sql.includes('FROM customer c')) return [{ n: state.riders }];
                    if (sql.includes('FROM "order" o')) return [{ n: 5, oldest: new Date().toISOString() }];
                    return [];
                }),
            },
        };
        await job.run();
        state.riders = 0;
        await job.run();
        const titles = (feishu.pushEvent as any).mock.calls.map((c: any[]) => c[1]);
        expect(titles).toEqual(['运力告警：骑手紧张', '运力告警：无在线骑手']);
    });

    it('推送失败不占冷却，下一轮重试', async () => {
        const delivered = { ok: false };
        const { job, feishu } = mkJob({
            channels: [A],
            riders: { 113: 0 },
            backlog: { 113: { count: 2, oldestMinutes: 1 } },
        });
        (feishu.pushEvent as any).mockImplementation(async () => delivered.ok);
        await job.run();
        expect(feishu.pushEvent).toHaveBeenCalledTimes(1);
        delivered.ok = true;
        await job.run();
        expect(feishu.pushEvent).toHaveBeenCalledTimes(2);
        await job.run();
        expect(feishu.pushEvent).toHaveBeenCalledTimes(2);
    });

    it('恢复健康后补一条「运力已恢复」，且只推一次', async () => {
        const state = { riders: 0, backlog: 4 };
        const { job, feishu } = mkJob({ channels: [A] });
        (job as any).connection = {
            rawConnection: {
                query: vi.fn(async (sql: string) => {
                    if (sql.includes('FROM campus_fulfillment_config')) return [A];
                    if (sql.includes('FROM customer c')) return [{ n: state.riders }];
                    if (sql.includes('FROM "order" o')) return [{ n: state.backlog, oldest: null }];
                    return [];
                }),
            },
        };
        await job.run();
        state.riders = 3;
        state.backlog = 0;
        await job.run();
        await job.run();
        const titles = (feishu.pushEvent as any).mock.calls.map((c: any[]) => c[1]);
        expect(titles).toEqual(['运力告警：无在线骑手', '运力已恢复']);
        const recover = (feishu.pushEvent as any).mock.calls[1];
        expect(recover[2]).toContain('在线骑手 3 人');
        expect(recover[2]).toContain('运力已恢复正常');
    });

    it('CAPACITY_ALERT_CHANNELS 白名单只告警指定渠道', async () => {
        const { job, feishu } = mkJob({
            channels: [A, B],
            riders: { 113: 0, 114: 0 },
            backlog: { 113: { count: 2, oldestMinutes: 1 }, 114: { count: 2, oldestMinutes: 1 } },
            settings: { channels: ['canteen-b'] },
        });
        await job.run();
        expect(feishu.pushEvent).toHaveBeenCalledTimes(1);
        expect((feishu.pushEvent as any).mock.calls[0][5].channel).toBe('canteen-b');
    });

    it('飞书未启用时只记录日志，不外发', async () => {
        const { job, feishu } = mkJob({
            channels: [A],
            riders: { 113: 0 },
            backlog: { 113: { count: 2, oldestMinutes: 1 } },
            enabled: false,
        });
        await job.run();
        expect(feishu.pushEvent).not.toHaveBeenCalled();
    });
});

describe('readCapacityAlertSettings', () => {
    it('默认值', () => {
        const s = readCapacityAlertSettings({} as any);
        expect(s).toMatchObject({
            enabled: true,
            intervalMs: 5 * 60_000,
            bootDelayMs: 60_000,
            cooldownMs: 30 * 60_000,
            noRiderBacklog: 1,
            tightBacklog: 5,
            tightRiders: 2,
            atAll: true,
            channels: [],
        });
    });

    it('环境变量覆盖 + 非法值回退', () => {
        const s = readCapacityAlertSettings({
            CAPACITY_ALERT_ENABLED: 'false',
            CAPACITY_ALERT_INTERVAL_MIN: '0',
            CAPACITY_ALERT_COOLDOWN_MIN: '10',
            CAPACITY_ALERT_NO_RIDER_BACKLOG: '2',
            CAPACITY_ALERT_TIGHT_BACKLOG: 'abc',
            CAPACITY_ALERT_TIGHT_RIDERS: '1',
            CAPACITY_ALERT_AT_ALL: 'off',
            CAPACITY_ALERT_CHANNELS: ' canteen-a , canteen-b ,,',
        } as any);
        expect(s.enabled).toBe(false);
        expect(s.intervalMs).toBe(5 * 60_000);
        expect(s.cooldownMs).toBe(10 * 60_000);
        expect(s.noRiderBacklog).toBe(2);
        expect(s.tightBacklog).toBe(5);
        expect(s.tightRiders).toBe(1);
        expect(s.atAll).toBe(false);
        expect(s.channels).toEqual(['canteen-a', 'canteen-b']);
    });
});

describe('capacityOpsLink', () => {
    it('默认拼后台运营中心', () => {
        expect(capacityOpsLink({} as any)).toBe('https://e.joho.cn/guanli/#/pages/campus/ops');
    });
    it('ADMIN_UI_BASE_URL 支持 origin 或已带 /guanli', () => {
        expect(capacityOpsLink({ ADMIN_UI_BASE_URL: 'https://e.joho.cn' } as any))
            .toBe('https://e.joho.cn/guanli/#/pages/campus/ops');
        expect(capacityOpsLink({ ADMIN_UI_BASE_URL: 'https://e.joho.cn/guanli/' } as any))
            .toBe('https://e.joho.cn/guanli/#/pages/campus/ops');
    });
    it('CAPACITY_ALERT_LINK 优先', () => {
        expect(capacityOpsLink({ CAPACITY_ALERT_LINK: 'https://x/y' } as any)).toBe('https://x/y');
    });
});
