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
    return { svc: new WaimaiStoreService(conn), repoByEntity };
}

describe('WaimaiStoreService.listStores', () => {
    it('仅返回有履约配置的渠道并解析 tags，新 6 字段从配置透出', async () => {
        const env = makeEnv({
            configs: [
                { channelId: 1, paused: false, routesEnabled: ['R3'] },   // 默认渠道脏配置：应被跳过
                { channelId: 2, paused: false, routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢', errandBaseFee: 300 },
            ],
            channels: [
                { id: 1, token: 'default', code: '__default_channel__', customFields: {} },
                { id: 2, token: 'canteen', code: '一食堂麻辣香锅',
                  customFields: { waimaiTags: '米饭快餐, 夜宵', waimaiMonthlySales: 320, waimaiLogo: '/static/a.webp', waimaiPromoText: '满20减4' } },
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
            errandBaseFee: 300,
        });
    });
    it('空 tags/缺月售/缺新字段容错（全 null），paused 透传', async () => {
        const env = makeEnv({
            configs: [{ channelId: 9, paused: true, routesEnabled: [] }],
            channels: [{ id: 9, token: 'x', code: 'x店', customFields: {} }],
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
        });
        expect(list[1]).toEqual({
            channelId: 3, channelName: '奶茶铺', channelToken: 'milktea',
            routesEnabled: [],
            deliveryMinutes: null, minOrderAmount: null, deliveryFee: null,
            storeAddress: null, storePhone: null, storeNotice: null,
            errandBaseFee: null,
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
        const input = { routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢' };
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
        const out = await env.svc.updateStoreConfig({} as any, 2, { routesEnabled: ['R2'], storeNotice: '公告' });
        expect(out).toEqual({
            channelId: 2, channelName: '一食堂麻辣香锅', channelToken: 'canteen',
            routesEnabled: ['R2'],
            deliveryMinutes: null, minOrderAmount: null, deliveryFee: null,
            storeAddress: null, storePhone: null, storeNotice: '公告',
            errandBaseFee: null,
        });
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
