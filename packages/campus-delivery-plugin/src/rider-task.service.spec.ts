// 纯逻辑单测：状态机（assigned 可开始 / 状态不符拒）、分成计算（100% 与 80%）、照片必传、非本骑手拒
import { describe, expect, it, vi } from 'vitest';
import { RiderTaskService } from './rider-task.service';

function make(order: any, cfg: any = { riderCommissionRate: 100 }) {
    const riderSvc = { assertApprovedRider: vi.fn().mockResolvedValue({ id: 9 }) } as any;
    const saved: any[] = [];
    // findOne 调用次序：deliver = assertOwner(查单) → getConfig(查配置)；start = assertOwner(查单)
    const repo = {
        findOne: vi.fn().mockImplementation((opts: any) =>
            opts?.where?.channelId !== undefined ? Promise.resolve(cfg) : Promise.resolve(order)),
        update: vi.fn().mockResolvedValue({}),
        save: vi.fn().mockImplementation((v: any) => {
            saved.push(v);
            // 落库后带 id（分成行 CAS 认领需要行 id）
            return Promise.resolve({ id: 501, ...v });
        }),
    };
    const rawQuery = vi.fn().mockResolvedValue([[{ id: 10 }], []]);
    const conn = {
        getRepository: () => repo,
        // deliver 原子认领（RETURNING id）：TypeORM PG query 返回 [rows, fields]
        rawConnection: { query: rawQuery },
    } as any;
    return { svc: new RiderTaskService(conn, riderSvc, { adjust: vi.fn().mockResolvedValue(102) } as any, { backToHall: vi.fn() } as any, { user: vi.fn() } as any), repo, saved, rawQuery };
}

const assigned = { id: 10, code: 'A1', shipping: 300, customFields: { deliveryStaffId: '9', deliveryStatus: 'assigned', tip: 100 } };

describe('RiderTaskService', () => {
    it('assigned 可开始配送', async () => {
        const { svc, rawQuery } = make(assigned);
        await svc.start({ channelId: 1 } as any, 10 as any);
        expect(rawQuery).toHaveBeenCalledTimes(1);
        expect(rawQuery.mock.calls[0][0]).toContain('"customFieldsDeliverystatus"');
        expect(rawQuery.mock.calls[0][1]).toEqual(['in_progress', 10, 'assigned', '9', 'grabbed']);
    });
    it('接力单交接码正确 → 可开始配送', async () => {
        const relay = { ...assigned, customFields: { ...assigned.customFields, handoverCode: '1234' } };
        const { svc, rawQuery } = make(relay);
        await svc.start({ channelId: 1 } as any, 10 as any, '1234');
        expect(rawQuery).toHaveBeenCalledTimes(1);
        expect(rawQuery.mock.calls[0][1][0]).toBe('in_progress');
    });
    it('开始配送时订单已被取消/改派（条件写未命中）→ 拒绝', async () => {
        const { svc, rawQuery } = make(assigned);
        rawQuery.mockResolvedValueOnce([[], []]);
        await expect(svc.start({ channelId: 1 } as any, 10 as any)).rejects.toThrow('订单已被取消或改派');
    });
    it('接力单交接码错误/缺失 → 拒绝开始配送', async () => {
        const relay = { ...assigned, customFields: { ...assigned.customFields, handoverCode: '1234' } };
        const { svc } = make(relay);
        await expect(svc.start({ channelId: 1 } as any, 10 as any, '9999')).rejects.toThrow('交接码不正确');
        await expect(svc.start({ channelId: 1 } as any, 10 as any)).rejects.toThrow('交接码不正确');
    });
    it('delivered 需照片且分成=配送费+小费（单条原子写终态 + 认领后入账）', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, saved, rawQuery } = make(inProg, { riderCommissionRate: 100 });
        await svc.deliver({ channelId: 1 } as any, 10 as any, ['p1']);
        // 第一次：认领与终态同一条 UPDATE（delivered + hallStatus + 照片 JSON + 分成 一次落库）
        // 第二次：P1 分成行 CAS 认领（pending → crediting），认领成功才入账
        expect(rawQuery).toHaveBeenCalledTimes(2);
        expect(rawQuery.mock.calls[0][0]).toContain('"customFieldsHallstatus"');
        expect(rawQuery.mock.calls[0][1]).toEqual([
            'delivered', expect.any(Date), 'delivered', JSON.stringify(['p1']), null, 400, 10, 'in_progress',
            '9', 'grabbed',
        ]);
        expect(rawQuery.mock.calls[1][0]).toContain('UPDATE rider_earning');
        expect(rawQuery.mock.calls[1][1]).toEqual(['crediting', 501, 'pending']);
        expect(saved[0].amount).toBe(400); // 300 shipping + 100 tip
    });
    it('并发双送达/已取消 → 认领失败拒绝，不写分成（防双入账）', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, saved, rawQuery } = make(inProg);
        rawQuery.mockResolvedValueOnce([[], []]);
        await expect(svc.deliver({ channelId: 1 } as any, 10 as any, ['p1'])).rejects.toThrow('订单已被取消或处理');
        expect(rawQuery.mock.calls[0][0]).toContain(`"state" <> 'Cancelled'`);
        expect(saved).toHaveLength(0);
    });
    it('分成比例 80%', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, saved } = make(inProg, { riderCommissionRate: 80 });
        await svc.deliver({ channelId: 1 } as any, 10 as any, ['p1']);
        expect(saved[0].amount).toBe(320);
    });
    it('无照片拒单', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc } = make(inProg);
        await expect(svc.deliver({ channelId: 1 } as any, 10 as any, [])).rejects.toThrow('送达需至少一张照片');
    });
    it('非本骑手拒', async () => {
        const other = { ...assigned, customFields: { deliveryStaffId: '8', deliveryStatus: 'assigned' } };
        const { svc } = make(other);
        await expect(svc.start({ channelId: 1 } as any, 10 as any)).rejects.toThrow();
    });
    it('0 分成单（0 运费 0 小费）不入账不写 earning 且不抛错', async () => {
        const zero = { id: 11, code: 'A2', shipping: 0, customFields: { deliveryStaffId: '9', deliveryStatus: 'in_progress', tip: 0 } };
        const { svc, saved } = make(zero, { riderCommissionRate: 80 });
        const order = await svc.deliver({ channelId: 1 } as any, 11 as any, ['p1']);
        expect(order).toBeTruthy();
        expect(saved).toHaveLength(0); // 未写 RiderEarning
    });
    it('有运费但分成 0（rate=0）也跳过入账（0 金额 pending 会触发余额端口报错）', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, saved } = make(inProg, { riderCommissionRate: 0 });
        await svc.deliver({ channelId: 1 } as any, 10 as any, ['p1']);
        expect(saved).toHaveLength(0);
    });
    it('大厅阶段（尚无 deliveryStatus）也可催单', async () => {
        const hallOrder = {
            id: 12, code: 'A3', shipping: 0,
            customFields: { hallStatus: 'open' },
            customer: { user: { id: 5 } },
        };
        const { svc, repo } = make(hallOrder);
        await svc.urgeOrder({ channelId: 1, activeUserId: 5 } as any, 12 as any);
        expect(repo.update).toHaveBeenCalledWith(12, expect.objectContaining({
            customFields: expect.objectContaining({ urged: true }),
        }));
    });
    it('已送达终态 → 拒绝催单', async () => {
        const done = {
            id: 13, code: 'A4', shipping: 0,
            customFields: { hallStatus: 'delivered', deliveryStatus: 'delivered' },
            customer: { user: { id: 5 } },
        };
        const { svc } = make(done);
        await expect(svc.urgeOrder({ channelId: 1, activeUserId: 5 } as any, 13 as any)).rejects.toThrow('当前状态无需催单');
    });
    it('非配送中状态（已送达）上报异常 → 拒绝', async () => {
        const done = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'delivered' } };
        const { svc } = make(done);
        await expect(svc.reportException({ channelId: 1 } as any, 10 as any, 'food_spilled', ['p1']))
            .rejects.toThrow('当前状态不允许上报异常');
    });
    it('配送中上报异常 → 条件写 exception（含骑手归属与未取消守卫）', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, rawQuery } = make(inProg);
        await svc.reportException({ channelId: 1 } as any, 10 as any, 'food_spilled', ['p1'], '洒漏');
        expect(rawQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = rawQuery.mock.calls[0];
        expect(sql).toContain('"customFieldsExceptiontype"');
        expect(sql).toContain(`"state" <> 'Cancelled'`);
        expect(params).toEqual([
            'exception', 'food_spilled', JSON.stringify(['p1']), '洒漏', expect.any(Date), 10, ['assigned', 'in_progress'], '9',
        ]);
    });
    it('上报异常时订单已被取消/改派（条件写未命中）→ 拒绝', async () => {
        const inProg = { ...assigned, customFields: { ...assigned.customFields, deliveryStatus: 'in_progress' } };
        const { svc, rawQuery } = make(inProg);
        rawQuery.mockResolvedValueOnce([[], []]);
        await expect(svc.reportException({ channelId: 1 } as any, 10 as any, 'food_spilled', ['p1']))
            .rejects.toThrow('订单已被取消或改派');
    });
});
