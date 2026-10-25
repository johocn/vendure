import { UserInputError } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { WaimaiStoreService } from './waimai-store.service';

function makeEnv(opts: { channels?: any[]; configs?: any[] } = {}) {
    const repoByEntity: Record<string, any> = {
        CampusFulfillmentConfig: {
            find: vi.fn().mockResolvedValue(opts.configs ?? []),
            findOne: vi.fn(),
            save: vi.fn(async (x: any) => x),
        },
        Channel: {
            find: vi.fn().mockResolvedValue(opts.channels ?? []),
            findOne: vi.fn(),
        },
    };
    const conn = { getRepository: vi.fn((_ctx: any, ent: any) => repoByEntity[ent.name ?? String(ent)]) } as any;
    // 默认桩：updateStoreConfig 带 storeAddress 时会走 R4 自提点 upsert（rawConnection），既有用例不对其断言
    conn.rawConnection = {
        getRepository: vi.fn(() => ({ findOne: vi.fn().mockResolvedValue(undefined), save: vi.fn(async (x: any) => x) })),
    };
    return { svc: new WaimaiStoreService(conn), repoByEntity };
}

describe('WaimaiStoreService.listStores', () => {
    it('仅返回有履约配置的渠道并解析 tags，新 6 字段从配置透出', async () => {
        const env = makeEnv({
            configs: [
                { channelId: 1, paused: false, routesEnabled: ['R3'] },   // 默认渠道脏配置：应被跳过
                { channelId: 2, paused: false, routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢', errandBaseFee: 300, freeShippingThreshold: 1800 },
            ],
            channels: [
                { id: 1, token: 'default', code: '__default_channel__', customFields: {} },
                { id: 2, token: 'canteen', code: '一食堂麻辣香锅',
                  customFields: { waimaiTags: '米饭快餐, 夜宵', waimaiMonthlySales: 320, waimaiLogo: '/static/a.webp', waimaiPromoText: '满20减4', industryType: 'catering' } },
            ],
        });
        const list = await env.svc.listStores({} as any);
        expect(list).toHaveLength(1);
        expect(list[0]).toEqual({
            channelId: 2, channelToken: 'canteen', name: '一食堂麻辣香锅',
            logo: '/static/a.webp', tags: ['米饭快餐', '夜宵'], monthlySales: 320,
            promoText: '满20减4',
            paused: false, routesEnabled: ['R1', 'R3'],
            deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200,
            storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢',
            businessHours: null,
            openNow: true,
            errandBaseFee: 300,
            freeShippingThreshold: 1800,
        });
    });
    it('空 tags/缺月售/缺新字段容错（全 null），paused 透传', async () => {
        const env = makeEnv({
            configs: [{ channelId: 9, paused: true, routesEnabled: [] }],
            channels: [{ id: 9, token: 'x', code: 'x店', customFields: { industryType: 'catering' } }],
        });
        const list = await env.svc.listStores({} as any);
        expect(list[0].tags).toEqual([]);
        expect(list[0].monthlySales).toBe(0);
        expect(list[0].promoText).toBeNull();
        expect(list[0].paused).toBe(true);
        expect(list[0].deliveryMinutes).toBeNull();
        expect(list[0].minOrderAmount).toBeNull();
        expect(list[0].deliveryFee).toBeNull();
        expect(list[0].storeAddress).toBeNull();
        expect(list[0].storePhone).toBeNull();
        expect(list[0].storeNotice).toBeNull();
        expect(list[0].errandBaseFee).toBeNull();
    });
});

describe('WaimaiStoreService.listStoreConfigs', () => {
    it('全渠道输出（默认渠道跳过），无配置行店铺 routesEnabled=[] 且 6 字段全 null', async () => {
        const env = makeEnv({
            configs: [{ channelId: 2, paused: false, routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢' }],
            channels: [
                { id: 1, token: 'default', code: '__default_channel__' },
                { id: 2, token: 'canteen', code: '一食堂麻辣香锅' },
                { id: 3, token: 'milktea', code: '奶茶铺' },
            ],
        });
        const list = await env.svc.listStoreConfigs({} as any);
        expect(list).toHaveLength(2);
        expect(list[0]).toEqual({
            channelId: 2, channelName: '一食堂麻辣香锅', channelToken: 'canteen',
            routesEnabled: ['R1', 'R3'],
            deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200,
            storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢',
            errandBaseFee: null,
            thirdPartyBaseFee: null,
            freeShippingThreshold: null,
            notifyTemplateAccepted: null, notifyTemplateRiderAssigned: null,
            notifyTemplateCookingDone: null, notifyTemplateDelivered: null,
            notifyTemplateExceptionHandled: null,
            notifyTemplateOrderPlaced: null, notifyTemplatePaymentPending: null,
            notifyTemplateCancelled: null, notifyTemplateAfterSales: null,
            notifyTemplateAddressChanged: null,
            h5BaseUrl: null,
            printMode: 'off',
            timeoutCompensationEnabled: true, timeoutCompensationWindowHours: 24, timeoutGraceMinutes: 10, timeoutCompensationCouponTemplateId: null,
            dynamicPricing: null,
            routeFirstLeg: [], handoverPoints: [], providerShopNo: [],
            merchantAcceptMinutes: 5, externalPushTimeoutMinutes: 10, externalFallbackMinutes: 20,
            storeLat: null, storeLng: null,
        });
        expect(list[1]).toEqual({
            channelId: 3, channelName: '奶茶铺', channelToken: 'milktea',
            routesEnabled: [],
            deliveryMinutes: null, minOrderAmount: null, deliveryFee: null,
            storeAddress: null, storePhone: null, storeNotice: null,
            errandBaseFee: null,
            thirdPartyBaseFee: null,
            freeShippingThreshold: null,
            notifyTemplateAccepted: null, notifyTemplateRiderAssigned: null,
            notifyTemplateCookingDone: null, notifyTemplateDelivered: null,
            notifyTemplateExceptionHandled: null,
            notifyTemplateOrderPlaced: null, notifyTemplatePaymentPending: null,
            notifyTemplateCancelled: null, notifyTemplateAfterSales: null,
            notifyTemplateAddressChanged: null,
            h5BaseUrl: null,
            printMode: 'off',
            timeoutCompensationEnabled: true, timeoutCompensationWindowHours: 24, timeoutGraceMinutes: 10, timeoutCompensationCouponTemplateId: null,
            dynamicPricing: null,
            routeFirstLeg: [], handoverPoints: [], providerShopNo: [],
            merchantAcceptMinutes: 5, externalPushTimeoutMinutes: 10, externalFallbackMinutes: 20,
            storeLat: null, storeLng: null,
        });
    });
});

describe('WaimaiStoreService.updateStoreConfig', () => {
    it('无配置行则创建（upsert 幂等）：同 channelId 二次调用更新不新增行', async () => {
        const env = makeEnv({
            channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }],
        });
        const cfgRepo = env.repoByEntity.CampusFulfillmentConfig;
        cfgRepo.findOne.mockResolvedValueOnce(undefined);   // 第一次：无行
        cfgRepo.findOne.mockResolvedValueOnce({ channelId: 2, routesEnabled: ['R1'] });   // 第二次：已有行
        const input = { routesEnabled: ['R1', 'R3'], handoverPoints: [{ route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2 }], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢' };
        await env.svc.updateStoreConfig({} as any, 2, input);
        await env.svc.updateStoreConfig({} as any, 2, { ...input, routesEnabled: ['R3'] });
        expect(cfgRepo.save).toHaveBeenCalledTimes(2);
        expect(cfgRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('白名单校验：routesEnabled 含 R9 抛 UserInputError，不落库', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }] });
        const cfgRepo = env.repoByEntity.CampusFulfillmentConfig;
        cfgRepo.findOne.mockResolvedValue({ channelId: 2, routesEnabled: ['R1'] });
        await expect(env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R1', 'R9'] }))
            .rejects.toThrow(UserInputError);
        expect(cfgRepo.save).not.toHaveBeenCalled();
    });

    it('金额/时长负数拒绝', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }] });
        env.repoByEntity.CampusFulfillmentConfig.findOne.mockResolvedValue({ channelId: 2, routesEnabled: ['R1'] });
        await expect(env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R1'], minOrderAmount: -1 }))
            .rejects.toThrow(UserInputError);
        await expect(env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R1'], deliveryFee: -5 }))
            .rejects.toThrow(UserInputError);
        await expect(env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R1'], deliveryMinutes: -10 }))
            .rejects.toThrow(UserInputError);
    });

    it('渠道不存在抛 UserInputError', async () => {
        const env = makeEnv({});
        env.repoByEntity.Channel.findOne.mockResolvedValue(undefined);
        await expect(env.svc.updateStoreConfig({} as any, 99, { routesEnabled: ['R1'] }))
            .rejects.toThrow(UserInputError);
    });

    it('成功保存后返回 WithChannel 视图', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }] });
        env.repoByEntity.CampusFulfillmentConfig.findOne.mockResolvedValue({ channelId: 2, routesEnabled: ['R1'] });
        const out = await env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R2'], handoverPoints: [{ route: 'R2', name: '菜鸟驿站', lat: 30.2, lng: 120.25 }], storeNotice: '公告' });
        expect(out).toEqual({
            channelId: 2, channelName: '一食堂麻辣香锅', channelToken: 'canteen',
            routesEnabled: ['R2'],
            deliveryMinutes: null, minOrderAmount: null, deliveryFee: null,
            storeAddress: null, storePhone: null, storeNotice: '公告',
            errandBaseFee: null,
            thirdPartyBaseFee: null,
            freeShippingThreshold: null,
            notifyTemplateAccepted: null, notifyTemplateRiderAssigned: null,
            notifyTemplateCookingDone: null, notifyTemplateDelivered: null,
            notifyTemplateExceptionHandled: null,
            notifyTemplateOrderPlaced: null, notifyTemplatePaymentPending: null,
            notifyTemplateCancelled: null, notifyTemplateAfterSales: null,
            notifyTemplateAddressChanged: null,
            h5BaseUrl: null,
            printMode: 'off',
            timeoutCompensationEnabled: true, timeoutCompensationWindowHours: 24, timeoutGraceMinutes: 10, timeoutCompensationCouponTemplateId: null,
            dynamicPricing: null,
            routeFirstLeg: [],
            handoverPoints: [{ route: 'R2', name: '菜鸟驿站', address: null, phone: null, lat: 30.2, lng: 120.25, isDefault: true }],
            providerShopNo: [],
            merchantAcceptMinutes: 5, externalPushTimeoutMinutes: 10, externalFallbackMinutes: 20,
            storeLat: null, storeLng: null,
        });
    });

    it('未传字段即保留原值，显式 null 才清空（局部更新不清空既有配置）', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂' }] });
        const cfgRepo = env.repoByEntity.CampusFulfillmentConfig;
        cfgRepo.findOne.mockResolvedValue({
            channelId: 2, routesEnabled: ['R1'],
            handoverPoints: { R1: { route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2 } },
            deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼',
            storePhone: '13800000000', storeNotice: '周末出餐慢', errandBaseFee: 300, freeShippingThreshold: 1800,
            notifyTemplateAccepted: 'TPL-A', h5BaseUrl: 'https://h5.example.com', printMode: 'onPaid',
        });
        const kept = await env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R1'] } as any);
        expect(kept).toMatchObject({
            deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼',
            storePhone: '13800000000', storeNotice: '周末出餐慢', errandBaseFee: 300, freeShippingThreshold: 1800,
            notifyTemplateAccepted: 'TPL-A', h5BaseUrl: 'https://h5.example.com', printMode: 'onPaid',
        });
        // 显式 null 才允许清空
        const cleared = await env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R1'], storeNotice: null } as any);
        expect(cleared.storeNotice).toBeNull();
        expect(cleared.deliveryMinutes).toBe(35);
    });
});

describe('WaimaiStoreService.updateStoreConfig errandBaseFee', () => {
    it('errandBaseFee 负数拒绝', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], errandBaseFee: -1,
        } as any)).rejects.toThrow('不能为负数');
    });
    it('errandBaseFee 持久化并回读', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        const out = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R5'], errandBaseFee: 300,
        } as any);
        expect(out.errandBaseFee).toBe(300);
    });
});

describe('WaimaiStoreService.updateStoreConfig freeShippingThreshold（plan 3.2）', () => {
    it('负数拒绝', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], freeShippingThreshold: -100,
        } as any)).rejects.toThrow('不能为负数');
    });
    it('持久化并回读（null=不启用）', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        const out = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [{ route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2 }], freeShippingThreshold: 1800,
        } as any);
        expect(out.freeShippingThreshold).toBe(1800);
        const off = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [{ route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2 }], freeShippingThreshold: null,
        } as any);
        expect(off.freeShippingThreshold).toBeNull();
    });
});

describe('WaimaiStoreService R4 store pickup location upsert', () => {
    function makeLocEnv(locRepo: any) {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅', customFields: {} }] });
        (env.svc as any).connection.rawConnection = {
            getRepository: vi.fn(() => locRepo),
        };
        return env;
    }

    it('storeAddress 非空：新建自提点（type=store, remark=campus-r4, 绑渠道）', async () => {
        const locRepo = {
            findOne: vi.fn().mockResolvedValue(null),
            save: vi.fn(async (x: any) => ({ id: 55, ...x })),
        };
        const env = makeLocEnv(locRepo);
        await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R4'], storeAddress: '东门 1 号楼', storePhone: '13800000000',
        } as any);
        expect(locRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            name: '一食堂麻辣香锅', address: '东门 1 号楼', phoneNumber: '13800000000',
            type: 'store', ownerChannelId: 2, remark: 'campus-r4', channels: [{ id: 2 }],
        }));
    });

    it('已存在：更新地址不新建', async () => {
        const locRepo = {
            findOne: vi.fn().mockResolvedValue({ id: 55, name: '旧名', address: '旧址', phoneNumber: null, remark: 'campus-r4' }),
            save: vi.fn(async (x: any) => x),
        };
        const env = makeLocEnv(locRepo);
        await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R4'], storeAddress: '新址', storePhone: null,
        } as any);
        expect(locRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 55, address: '新址' }));
    });

    it('storeAddress 清空：跳过 upsert（不删除既有记录）', async () => {
        const locRepo = {
            findOne: vi.fn(), save: vi.fn(),
        };
        const env = makeLocEnv(locRepo);
        await env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R4'], storeAddress: null } as any);
        expect(locRepo.findOne).not.toHaveBeenCalled();
        expect(locRepo.save).not.toHaveBeenCalled();
    });
});

describe('WaimaiStoreService 配送矩阵配置', () => {
    const channel = { id: 2, token: 'canteen', code: '一食堂' };
    const point = { route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2 };

    it('R1/R3 第一段承运按数组写入并回读为数组', async () => {
        const env = makeEnv({ channels: [channel] });
        const out = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1', 'R3'],
            handoverPoints: [point],
            routeFirstLeg: [{ route: 'R1', carrier: 'owned' }, { route: 'R3', carrier: 'external' }],
            providerShopNo: [{ provider: 'dada', shopNo: 'D001' }, { provider: 'meituan', shopNo: 'M001' }],
            merchantAcceptMinutes: 8,
            externalPushTimeoutMinutes: 12,
            externalFallbackMinutes: 25,
            storeLat: 30.0,
            storeLng: 120.0,
        } as any);
        expect(out.routeFirstLeg).toEqual([
            { route: 'R1', carrier: 'owned' },
            { route: 'R3', carrier: 'external' },
        ]);
        expect(out.handoverPoints).toEqual([{ ...point, address: null, phone: null, isDefault: true }]);
        expect(out.providerShopNo).toHaveLength(2);
        expect(out).toMatchObject({
            merchantAcceptMinutes: 8, externalPushTimeoutMinutes: 12, externalFallbackMinutes: 25,
            storeLat: 30.0, storeLng: 120.0,
        });
    });

    it('R2/R4/R5 不允许配置第一段承运；非法承运值拒绝', async () => {
        const env = makeEnv({ channels: [channel] });
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R2'], routeFirstLeg: [{ route: 'R2', carrier: 'owned' }],
        } as any)).rejects.toThrow('不支持配置第一段承运方');
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], routeFirstLeg: [{ route: 'R1', carrier: 'external' }],
        } as any)).rejects.toThrow('第一段承运方不合法');
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R3'], routeFirstLeg: [{ route: 'R3', carrier: 'merchant' }],
        } as any)).rejects.toThrow('第一段承运方不合法');
    });

    it('开通 R1/R2 且提交了交接点时必须各有对应交接点', async () => {
        const env = makeEnv({ channels: [channel] });
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1', 'R2'], handoverPoints: [point],
        } as any)).rejects.toThrow('需要先填写至少一个校园交接点');
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [{ ...point, lat: 200 }],
        } as any)).rejects.toThrow('经纬度不合法');
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [{ ...point, route: 'R3' }],
        } as any)).rejects.toThrow('不需要校园交接点');
    });

    it('同一路线可配多个交接点，且只保留一个默认点', async () => {
        const env = makeEnv({ channels: [channel] });
        const out = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'],
            handoverPoints: [
                { route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2, isDefault: true },
                { route: 'R1', name: '西门驿站', lat: 30.3, lng: 120.4, isDefault: true },
            ],
        } as any);
        expect(out.handoverPoints).toHaveLength(2);
        expect(out.handoverPoints.filter(p => p.isDefault)).toEqual([
            expect.objectContaining({ name: '东门岗亭' }),
        ]);
        // 未标注默认点时，第一个自动成为默认
        const out2 = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'],
            handoverPoints: [{ route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2 }],
        } as any);
        expect(out2.handoverPoints[0].isDefault).toBe(true);
    });

    it('未传新字段即保留原值（旧后台表单不清空新配置）', async () => {
        const env = makeEnv({ channels: [channel] });
        const cfgRepo = env.repoByEntity.CampusFulfillmentConfig;
        cfgRepo.findOne.mockResolvedValue({
            channelId: 2, routesEnabled: ['R1', 'R3'],
            routeFirstLeg: { R3: 'owned' },
            handoverPoints: { R1: point },
            providerShopNo: { dada: 'D001' },
            merchantAcceptMinutes: 7,
        });
        const out = await env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R1', 'R3'], storeNotice: '改公告' } as any);
        expect(out.routeFirstLeg).toEqual([{ route: 'R3', carrier: 'owned' }]);
        expect(out.handoverPoints).toHaveLength(1);
        expect(out.providerShopNo).toEqual([{ provider: 'dada', shopNo: 'D001' }]);
        expect(out.merchantAcceptMinutes).toBe(7);
    });
});

describe('WaimaiStoreService.updateStoreConfig 数值/坐标校验（第13轮）', () => {
    const channel = { id: 2, token: 'canteen', code: '一食堂' };
    const point = { route: 'R1', name: '东门岗亭', lat: 30.1, lng: 120.2 };

    it('金额/时长超上限或低于下限拒绝，不落库', async () => {
        const env = makeEnv({ channels: [channel] });
        const cfgRepo = env.repoByEntity.CampusFulfillmentConfig;
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [point], minOrderAmount: 10_000_001,
        } as any)).rejects.toThrow('超出允许上限');
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [point], deliveryMinutes: 241,
        } as any)).rejects.toThrow('超出允许上限');
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [point], externalPushTimeoutMinutes: 0,
        } as any)).rejects.toThrow('不能小于');
        expect(cfgRepo.save).not.toHaveBeenCalled();
    });

    it('金额按整数分归一（小数四舍五入）', async () => {
        const env = makeEnv({ channels: [channel] });
        const out = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [point], minOrderAmount: 1500.6,
        } as any);
        expect(out.minOrderAmount).toBe(1501);
    });

    it('门店坐标越界/非有限数拒绝，传 null 可清空', async () => {
        const env = makeEnv({ channels: [channel] });
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [point], storeLat: 91,
        } as any)).rejects.toThrow('storeLat 不合法');
        await expect(env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [point], storeLng: Infinity,
        } as any)).rejects.toThrow('storeLng 不合法');

        env.repoByEntity.CampusFulfillmentConfig.findOne.mockResolvedValue({
            channelId: 2, routesEnabled: ['R1'], handoverPoints: { R1: point }, storeLat: 30.1, storeLng: 120.2,
        });
        const out = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1'], handoverPoints: [point], storeLat: null,
        } as any);
        expect(out.storeLat).toBeNull();
        expect(out.storeLng).toBe(120.2);
    });

    it('routesEnabled 重复项去重后落库', async () => {
        const env = makeEnv({ channels: [channel] });
        const out = await env.svc.updateStoreConfig({} as any, 2, {
            routesEnabled: ['R1', 'R1', 'R3'], handoverPoints: [point],
        } as any);
        expect(out.routesEnabled).toEqual(['R1', 'R3']);
    });
});
