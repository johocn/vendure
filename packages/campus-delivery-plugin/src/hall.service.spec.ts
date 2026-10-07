// 预约单入厅闸门 + 放量单测（plan 3.1）
import { describe, expect, it, vi } from 'vitest';
import { Order } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { HallService } from './hall.service';

function makeEnv(opts: { cfg?: any; slotLocked?: boolean; curHs?: string } = {}) {
    const updates: any[] = [];
    const orderRepo = {
        update: vi.fn().mockImplementation((_id: any, patch: any) => { updates.push(patch); return Promise.resolve({}); }),
        findOne: vi.fn().mockResolvedValue(
            opts.curHs !== undefined ? { id: 9, code: 'S1', customFields: { hallStatus: opts.curHs } } : null,
        ),
    };
    const cfgRepo = { findOne: vi.fn().mockResolvedValue(opts.cfg ?? null) };
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'CampusFulfillmentConfig') return cfgRepo;
            return orderRepo;
        }),
    } as any;
    const slotLock = { lock: vi.fn().mockResolvedValue(opts.slotLocked ?? true) };
    const svc = new HallService(conn, slotLock as any, { get: vi.fn() } as any, { listOnlineRiders: vi.fn().mockResolvedValue([]) } as any);
    return { svc, orderRepo, cfgRepo, updates };
}

const future = (min: number) => new Date(Date.now() + min * 60_000);

describe('HallService.onOrderPlaced 预约闸门', () => {
    const base = { id: 9, code: 'S1', customFields: { fulfillmentRoute: 'R3' } };

    it('scheduledFor 距今超 30min → 挂 scheduled 暂不入厅（不查商家配置）', async () => {
        const env = makeEnv();
        const order = { ...base, customFields: { fulfillmentRoute: 'R3', scheduledFor: future(120) } };
        await env.svc.onOrderPlaced({ channelId: 1 } as any, order as any);
        expect(env.updates[0].customFields.hallStatus).toBe('scheduled');
        expect(env.cfgRepo.findOne).not.toHaveBeenCalled();
    });

    it('锁位失败仍挂 scheduled 且带 campusCause=slot_full', async () => {
        const env = makeEnv({ slotLocked: false });
        const order = { ...base, customFields: { fulfillmentRoute: 'R3', scheduledFor: future(60) } };
        await env.svc.onOrderPlaced({ channelId: 1 } as any, order as any);
        expect(env.updates[0].customFields).toEqual({ hallStatus: 'scheduled', campusCause: 'slot_full' });
    });

    it('scheduledFor 距今不足 30min → 照旧即时入厅 open', async () => {
        const env = makeEnv();
        const order = { ...base, customFields: { fulfillmentRoute: 'R3', scheduledFor: future(10) } };
        await env.svc.onOrderPlaced({ channelId: 1 } as any, order as any);
        expect(env.updates[0].customFields.hallStatus).toBe('open');
        expect(env.updates[0].customFields.hallEnteredAt).toBeInstanceOf(Date);
    });

    it('无 scheduledFor（立即单）不受影响', async () => {
        const env = makeEnv({ cfg: { channelId: 1, merchantConfirmEnabled: false } });
        await env.svc.onOrderPlaced({ channelId: 1 } as any, { ...base, customFields: { fulfillmentRoute: 'R3' } } as any);
        expect(env.updates[0].customFields.hallStatus).toBe('open');
    });
});

describe('HallService.releaseScheduled', () => {
    const order = { id: 9, code: 'S1' } as unknown as Order;

    it('商家确认模式 → pending_merchant', async () => {
        const env = makeEnv();
        await env.svc.releaseScheduled({ channelId: 1 } as any, order, { merchantConfirmEnabled: true } as CampusFulfillmentConfig);
        expect(env.updates[0].customFields).toEqual({ hallStatus: 'pending_merchant' });
    });

    it('非确认模式 → 直接 open + hallEnteredAt 重置', async () => {
        const env = makeEnv();
        await env.svc.releaseScheduled({ channelId: 1 } as any, order, { merchantConfirmEnabled: false } as CampusFulfillmentConfig);
        expect(env.updates[0].customFields.hallStatus).toBe('open');
        expect(env.updates[0].customFields.hallEnteredAt).toBeInstanceOf(Date);
    });
});

describe('HallService.exitHall 取消脱厅（3.3）', () => {
    const order = { id: 9, code: 'S1' } as unknown as Order;

    it('大厅流转态 open → 清为 cancelled，不碰指派字段', async () => {
        const env = makeEnv({ curHs: 'open' });
        await env.svc.exitHall({ channelId: 1 } as any, order);
        expect(env.updates[0].customFields).toEqual({ hallStatus: 'cancelled' });
    });

    it('grabbed → 连带清骑手指派字段（任务卡不残留）', async () => {
        const env = makeEnv({ curHs: 'grabbed' });
        await env.svc.exitHall({ channelId: 1 } as any, order);
        expect(env.updates[0].customFields).toEqual({
            hallStatus: 'cancelled',
            deliveryStaffId: null,
            deliveryStatus: null,
            assignedAt: null,
        });
    });

    it('no_rider_final（T4 终态）→ 跳过不写，防竞态覆盖', async () => {
        const env = makeEnv({ curHs: 'no_rider_final' });
        await env.svc.exitHall({ channelId: 1 } as any, order);
        expect(env.updates).toHaveLength(0);
    });

    it('DB 无记录/无 hallStatus → 幂等跳过', async () => {
        const env = makeEnv();
        await env.svc.exitHall({ channelId: 1 } as any, order);
        expect(env.updates).toHaveLength(0);
    });
});
