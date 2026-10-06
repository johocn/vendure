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
                { channelId: 2, paused: false, routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢' },
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
    });
});
