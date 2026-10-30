// 纯逻辑单测：默认配置兜底
import { describe, expect, it, vi } from 'vitest';
import { CampusConfigService } from './campus-config.service';

describe('CampusConfigService.getConfig', () => {
    it('无配置时创建默认配置', async () => {
        const findOne = vi.fn().mockResolvedValue(null);
        const save = vi.fn().mockImplementation(v => Promise.resolve(v));
        const svc = new CampusConfigService({ getRepository: () => ({ findOne, save }) } as any, {} as any);
        const ctx = { channelId: 1 } as any;
        const cfg = await svc.getConfig(ctx);
        expect(save).toHaveBeenCalledOnce();
        expect(cfg.riderCommissionRate).toBe(100);
        expect(cfg.autoAssignMinutes).toBe(10);
        expect(cfg.paused).toBe(false);
    });
});

describe('CampusConfigService slots', () => {
    const mkRepo = (slots: any[]) => ({
        find: vi.fn().mockResolvedValue(slots),
        findOne: vi.fn(),
        save: vi.fn().mockImplementation(v => Promise.resolve({ id: 1, ...v })),
        createQueryBuilder: vi.fn(),
    });
    it('slotsForShop 只返回 active 且余量>0', async () => {
        const repo = mkRepo([
            { id: 1, slotDate: '2099-01-01', active: true, capacity: 20, lockedCount: 20 },
            { id: 2, slotDate: '2099-01-01', active: true, capacity: 20, lockedCount: 5 },
            { id: 3, slotDate: '2099-01-01', active: false, capacity: 20, lockedCount: 0 },
        ]);
        const svc = new CampusConfigService({ getRepository: () => repo } as any, {} as any);
        const out = await svc.slotsForShop({ channelId: 1 } as any);
        expect(out.map((s: any) => s.id)).toEqual([2]);
        expect(out[0].remaining).toBe(15);
    });
    it('createSlot 落 channelId', async () => {
        const repo = mkRepo([]);
        const svc = new CampusConfigService({ getRepository: () => repo } as any, {} as any);
        await svc.createSlot({ channelId: 7 } as any, { slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30', capacity: 30 });
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ channelId: 7, capacity: 30 }));
    });
    it('updateSlot 只能改本渠道时段（跨渠道 → 时段不存在）', async () => {
        const repo = mkRepo([]);
        repo.findOne.mockResolvedValue(null);
        const svc = new CampusConfigService({ getRepository: () => repo } as any, {} as any);
        await expect(svc.updateSlot({ channelId: 2 } as any, 5, { capacity: 30 })).rejects.toThrow('时段不存在');
        expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 5, channelId: 2 } });
        expect(repo.save).not.toHaveBeenCalled();
    });
});

describe('setDeliveryTarget route/slot 扩展', () => {
    const slot = {
        id: 5, channelId: 1, active: true, capacity: 20, lockedCount: 3,
        slotDate: '2099-01-01', startTime: '11:00', endTime: '11:30',
    };
    const ctx = { channelId: 1, session: { activeOrderId: 100 } } as any;

    function makeEnv(opts: { slot?: any; cfg?: any } = {}) {
        const zoneRepo = { findOne: vi.fn().mockResolvedValue({ id: 1, name: '东区', channelId: 1 }) };
        const buildingRepo = { findOne: vi.fn().mockResolvedValue({ id: 7, name: '1号楼', zoneId: 1, channelId: 1 }) };
        const slotRepo = { findOne: vi.fn().mockResolvedValue(opts.slot === undefined ? slot : opts.slot) };
        const cfgRepo = {
            findOne: vi.fn().mockResolvedValue(
                opts.cfg === undefined
                    ? {
                          channelId: 1,
                          routesEnabled: ['R1', 'R2', 'R3'],
                          // R1/R2 派单前置（P1）：门店坐标 + 对应路线交接点齐备，否则 setDeliveryTarget 会提前拦截
                          storeLat: 30,
                          storeLng: 120,
                          handoverPoints: {
                              R1: [{ name: '南门交接点', lat: 30, lng: 120 }],
                              R2: [{ name: '东门交接点', lat: 30, lng: 120 }],
                          },
                      }
                    : opts.cfg,
            ),
        };
        const repos: Record<string, any> = {
            CampusZone: zoneRepo,
            CampusBuilding: buildingRepo,
            DeliverySlot: slotRepo,
            CampusFulfillmentConfig: cfgRepo,
        };
        const dataSource = { getRepository: vi.fn((ent: any) => repos[ent.name ?? String(ent)]) } as any;
        const orderService = { updateCustomFields: vi.fn().mockResolvedValue({ id: 100 }) } as any;
        const svc = new CampusConfigService(dataSource, orderService);
        return { svc, orderService, slotRepo, cfgRepo };
    }

    it('传 route+slotId 时写全 fulfillmentRoute/deliverySlotId/deliverySlotText/scheduledFor', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R3', 5);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
            fulfillmentRoute: 'R3',
            deliverySlotId: '5',
            deliverySlotText: '2099-01-01 11:00-11:30',
            scheduledFor: new Date('2099-01-01T11:00:00'),
        });
    });
    it('过期时段（历史日期）→ 拒绝下单', async () => {
        const env = makeEnv({ slot: { ...slot, slotDate: '2000-01-01' } });
        await expect(env.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段已过期');
    });
    it('分区/楼栋跨渠道 → 拒绝', async () => {
        const env = makeEnv();
        await expect(env.svc.setDeliveryTarget({ ...ctx, channelId: 2 } as any, 1, 7, 'R1')).rejects.toThrow('分区不属于当前店铺');
    });
    it('slot 余量为 0 抛 UserInputError("该时段已满")', async () => {
        const env = makeEnv({ slot: { ...slot, lockedCount: 20 } });
        await expect(env.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('该时段已满');
    });
    it('slot 跨渠道/不存在/未激活 抛 UserInputError("时段不可用")', async () => {
        const a = makeEnv({ slot: { ...slot, channelId: 2 } });
        await expect(a.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
        const b = makeEnv({ slot: null });
        await expect(b.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
        const c = makeEnv({ slot: { ...slot, active: false } });
        await expect(c.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
    });
    it('已选配送方式 → 改地址后按同一方式重算运费', async () => {
        const env = makeEnv();
        env.orderService.updateCustomFields.mockResolvedValue({
            id: 100, state: 'AddingItems', shippingLines: [{ shippingMethodId: 9 }],
        });
        env.orderService.setShippingMethod = vi.fn().mockResolvedValue({ id: 100, totalWithTax: 6000 });
        const order = await env.svc.setDeliveryTarget(ctx, 1, 7, 'R1');
        expect(env.orderService.setShippingMethod).toHaveBeenCalledWith(ctx, 100, [9]);
        expect((order as any).totalWithTax).toBe(6000);
    });

    it('已选方式不适用于新地址/路线 → 清空并提示重选', async () => {
        const env = makeEnv();
        env.orderService.updateCustomFields.mockResolvedValue({
            id: 100, state: 'AddingItems', shippingLines: [{ shippingMethodId: 9 }],
        });
        env.orderService.setShippingMethod = vi.fn()
            .mockResolvedValueOnce({ __typename: 'IneligibleShippingMethodError', errorCode: 'INELIGIBLE_SHIPPING_METHOD_ERROR', message: '不适用' })
            .mockResolvedValueOnce({ id: 100 });
        await expect(env.svc.setDeliveryTarget(ctx, 1, 7, 'R1')).rejects.toThrow('请重新选择配送方式');
        expect(env.orderService.setShippingMethod).toHaveBeenLastCalledWith(ctx, 100, []);
    });

    it('未选配送方式 / 非 AddingItems → 不触发重算', async () => {
        const env = makeEnv();
        env.orderService.setShippingMethod = vi.fn();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R1');
        expect(env.orderService.setShippingMethod).not.toHaveBeenCalled();

        const paid = makeEnv();
        paid.orderService.updateCustomFields.mockResolvedValue({
            id: 100, state: 'ArrangingPayment', shippingLines: [{ shippingMethodId: 9 }],
        });
        paid.orderService.setShippingMethod = vi.fn();
        await paid.svc.setDeliveryTarget(ctx, 1, 7, 'R1');
        expect(paid.orderService.setShippingMethod).not.toHaveBeenCalled();
    });

    it('R2 放行写入 fulfillmentRoute=R2；其余非法 route 仍拒绝', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R2' as any);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(
            ctx, 100, expect.objectContaining({ fulfillmentRoute: 'R2' }),
        );
        const bad = makeEnv();
        await expect(bad.svc.setDeliveryTarget(ctx, 1, 7, 'R9' as any)).rejects.toThrow('配送路线不合法');
    });
    it('未传 slotId（尽快送，undefined）同样清空 slot 字段与预约锚点（防 stale scheduledFor）', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
            deliverySlotId: null,
            deliverySlotText: null,
            scheduledFor: null,
        });
    });
    it('显式 slotId=null（切回尽快送）同样清空残留字段', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R3', null as unknown as undefined);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
            fulfillmentRoute: 'R3',
            deliverySlotId: null,
            deliverySlotText: null,
            scheduledFor: null,
        });
    });

    it('R1/R2 前置未就绪（缺门店坐标 / 缺对应路线交接点）→ 拒绝下单', async () => {
        const noCoord = makeEnv({ cfg: { channelId: 1, routesEnabled: ['R1', 'R2', 'R3'], handoverPoints: { R1: [{ name: '南门', lat: 30, lng: 120 }], R2: [{ name: '东门', lat: 30, lng: 120 }] } } });
        await expect(noCoord.svc.setDeliveryTarget(ctx, 1, 7, 'R2' as any)).rejects.toThrow('该配送路线当前不可用');
        const noPoint = makeEnv({ cfg: { channelId: 1, routesEnabled: ['R1', 'R2', 'R3'], storeLat: 30, storeLng: 120, handoverPoints: {} } });
        await expect(noPoint.svc.setDeliveryTarget(ctx, 1, 7, 'R2' as any)).rejects.toThrow('该配送路线当前不可用');
        // R1 缺交接点同样拒绝（否则会静默降级为传信者直送但按 R1 收费）
        await expect(noPoint.svc.setDeliveryTarget(ctx, 1, 7, 'R1' as any)).rejects.toThrow('该配送路线当前不可用');
        // R3 不依赖交接点，仍可下单
        const env = makeEnv({ cfg: { channelId: 1, routesEnabled: ['R3'] } });
        await expect(env.svc.setDeliveryTarget(ctx, 1, 7, 'R3' as any)).resolves.toBeDefined();
    });

    it('渠道关闭的路线 → 拒绝下单', async () => {
        const env = makeEnv({ cfg: { channelId: 1, routesEnabled: ['R1'] } });
        await expect(env.svc.setDeliveryTarget(ctx, 1, 7, 'R3')).rejects.toThrow('该配送路线当前不可用');
    });

    it('分区专属时段与所选分区不一致 → 拒绝', async () => {
        const env = makeEnv({ slot: { ...slot, zoneId: 2 } });
        await expect(env.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('该时段不属于所选分区');
    });
});

describe('CampusConfigService.updateConfig 字段白名单（P2）', () => {
    function makeEnv(cfg: any = {}) {
        const repo = {
            findOne: vi.fn().mockResolvedValue({
                channelId: 1,
                routesEnabled: ['R1'],
                handoverPoints: { R1: [{ name: '南门交接点', lat: 30, lng: 120 }] },
                ...cfg,
            }),
            save: vi.fn().mockImplementation(v => Promise.resolve(v)),
        };
        const svc = new CampusConfigService({ getRepository: () => repo } as any, {} as any);
        return { svc, repo };
    }
    const ctx = { channelId: 1 } as any;

    it('拒绝身份列/未知字段注入（channelId / id）', async () => {
        const { svc, repo } = makeEnv();
        await expect(svc.updateConfig(ctx, { channelId: 2 } as any)).rejects.toThrow('不支持的配置字段');
        await expect(svc.updateConfig(ctx, { id: 9 } as any)).rejects.toThrow('不支持的配置字段');
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('数值字段越界/负数 → 拒绝', async () => {
        const { svc } = makeEnv();
        await expect(svc.updateConfig(ctx, { autoAssignMinutes: -1 } as any)).rejects.toThrow('autoAssignMinutes');
        await expect(svc.updateConfig(ctx, { riderCommissionRate: 101 } as any)).rejects.toThrow('riderCommissionRate');
    });

    it('合法字段写入；路线去重并校验', async () => {
        const { svc, repo } = makeEnv();
        await svc.updateConfig(ctx, { autoAssignMinutes: 20, routesEnabled: ['R1', 'R3', 'R3'] } as any);
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
            autoAssignMinutes: 20,
            routesEnabled: ['R1', 'R3'],
        }));
        const { svc: svc2 } = makeEnv();
        await expect(svc2.updateConfig(ctx, { routesEnabled: ['R9'] } as any)).rejects.toThrow('配送路线配置不合法');
    });

    it('经纬度越界/非法 → 拒绝（合法值转数值落库）', async () => {
        const { svc, repo } = makeEnv();
        await expect(svc.updateConfig(ctx, { storeLat: 91 } as any)).rejects.toThrow('storeLat');
        await expect(svc.updateConfig(ctx, { storeLng: -181 } as any)).rejects.toThrow('storeLng');
        await expect(svc.updateConfig(ctx, { storeLat: 'abc' } as any)).rejects.toThrow('storeLat');
        expect(repo.save).not.toHaveBeenCalled();

        await svc.updateConfig(ctx, { storeLat: '30.5', storeLng: 120 } as any);
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ storeLat: 30.5, storeLng: 120 }));
    });

    it('结构化配置必须是对象（字符串/数组 → 拒绝）', async () => {
        const { svc, repo } = makeEnv();
        await expect(svc.updateConfig(ctx, { dynamicPricing: 'x' } as any)).rejects.toThrow('dynamicPricing 必须是对象');
        await expect(svc.updateConfig(ctx, { routeFirstLeg: [] } as any)).rejects.toThrow('routeFirstLeg 必须是对象');
        await expect(svc.updateConfig(ctx, { providerShopNo: 1 } as any)).rejects.toThrow('providerShopNo 必须是对象');
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('启用 R1 必须已配置 R1 交接点；启用 R2 还需要门店坐标与 R2 交接点', async () => {
        const { svc } = makeEnv();
        // 默认 cfg 已启用 R1，本次清空交接点 → 拒绝
        await expect(svc.updateConfig(ctx, { handoverPoints: {} } as any))
            .rejects.toThrow('R1 校园交接点');

        const noCoord = makeEnv();
        await expect(noCoord.svc.updateConfig(ctx, { routesEnabled: ['R1', 'R2'] } as any))
            .rejects.toThrow('门店取货点经纬度');
        const noPoint = makeEnv({ storeLat: 30, storeLng: 120 });
        await expect(noPoint.svc.updateConfig(ctx, { routesEnabled: ['R1', 'R2'] } as any))
            .rejects.toThrow('R2 校园交接点');
        expect(noPoint.repo.save).not.toHaveBeenCalled();

        // 前置齐备 → 放行
        const ok = makeEnv({
            storeLat: 30,
            storeLng: 120,
            handoverPoints: {
                R1: [{ name: '南门交接点', lat: 30, lng: 120 }],
                R2: [{ name: '东门交接点', lat: 30, lng: 120 }],
            },
        });
        await ok.svc.updateConfig(ctx, { routesEnabled: ['R1', 'R2'] } as any);
        expect(ok.repo.save).toHaveBeenCalled();
        // 不触碰 R2 前置的无关配置不应被连带拒绝（存量渠道兼容）
        await ok.svc.updateConfig(ctx, { storeNotice: '公告' } as any);
        expect(ok.repo.save).toHaveBeenCalled();
    });

    it('交接点校验：非对象/非数组/坐标非法 → 拒绝', async () => {
        const { svc, repo } = makeEnv();
        await expect(svc.updateConfig(ctx, { handoverPoints: 'x' } as any)).rejects.toThrow('handoverPoints 必须是对象');
        await expect(svc.updateConfig(ctx, { handoverPoints: { R2: 'x' } } as any)).rejects.toThrow('交接点 R2 必须是数组');
        await expect(svc.updateConfig(ctx, { handoverPoints: { R2: [{ lat: 'a', lng: 1 }] } } as any))
            .rejects.toThrow('交接点 R2 坐标不合法');
        expect(repo.save).not.toHaveBeenCalled();

        // 只保留 R2 点会清掉 R1 点：R1 仍启用 → 拒绝（避免静默降级）
        await expect(svc.updateConfig(ctx, { handoverPoints: { R2: [{ lat: 30, lng: 120 }] } } as any))
            .rejects.toThrow('R1 校园交接点');

        await svc.updateConfig(ctx, {
            handoverPoints: {
                R1: [{ name: '南门', lat: 30, lng: 120 }],
                R2: [{ name: '东门', lat: 30, lng: 120 }],
            },
        } as any);
        expect(repo.save).toHaveBeenCalled();
    });
});
