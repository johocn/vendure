// 预约单入厅闸门 + 放量单测（plan 3.1）
import { describe, expect, it, vi } from 'vitest';
import { Order } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { HallService } from './hall.service';

function makeEnv(opts: { cfg?: any; slotLocked?: boolean } = {}) {
    const updates: any[] = [];
    const orderRepo = { update: vi.fn().mockImplementation((_id: any, patch: any) => { updates.push(patch); return Promise.resolve({}); }) };
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
