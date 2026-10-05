"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const waimai_store_service_1 = require("./waimai-store.service");
function makeEnv(opts = {}) {
    var _a, _b;
    const repoByEntity = {
        CampusFulfillmentConfig: { find: vitest_1.vi.fn().mockResolvedValue((_a = opts.configs) !== null && _a !== void 0 ? _a : []) },
        Channel: { find: vitest_1.vi.fn().mockResolvedValue((_b = opts.channels) !== null && _b !== void 0 ? _b : []) },
    };
    const conn = { getRepository: vitest_1.vi.fn((_ctx, ent) => { var _a; return repoByEntity[(_a = ent.name) !== null && _a !== void 0 ? _a : String(ent)]; }) };
    return { svc: new waimai_store_service_1.WaimaiStoreService(conn), repoByEntity };
}
(0, vitest_1.describe)('WaimaiStoreService.listStores', () => {
    (0, vitest_1.it)('仅返回有履约配置的渠道并解析 tags', async () => {
        const env = makeEnv({
            configs: [
                { channelId: 1, paused: false, routesEnabled: ['R3'] }, // 默认渠道脏配置：应被跳过
                { channelId: 2, paused: false, routesEnabled: ['R1', 'R3'] },
            ],
            channels: [
                { id: 1, token: 'default', code: '__default_channel__', customFields: {} },
                { id: 2, token: 'canteen', code: '一食堂麻辣香锅',
                    customFields: { waimaiTags: '米饭快餐, 夜宵', waimaiMonthlySales: 320, waimaiLogo: '/static/a.webp', waimaiPromoText: '满20减4' } },
            ],
        });
        const list = await env.svc.listStores({});
        (0, vitest_1.expect)(list).toHaveLength(1);
        (0, vitest_1.expect)(list[0]).toEqual({
            channelId: 2, channelToken: 'canteen', name: '一食堂麻辣香锅',
            logo: '/static/a.webp', tags: ['米饭快餐', '夜宵'], monthlySales: 320,
            promoText: '满20减4',
            paused: false, routesEnabled: ['R1', 'R3'],
        });
    });
    (0, vitest_1.it)('空 tags/缺月售容错，paused 透传', async () => {
        const env = makeEnv({
            configs: [{ channelId: 9, paused: true, routesEnabled: [] }],
            channels: [{ id: 9, token: 'x', code: 'x店', customFields: {} }],
        });
        const list = await env.svc.listStores({});
        (0, vitest_1.expect)(list[0].tags).toEqual([]);
        (0, vitest_1.expect)(list[0].monthlySales).toBe(0);
        (0, vitest_1.expect)(list[0].promoText).toBeNull();
        (0, vitest_1.expect)(list[0].paused).toBe(true);
    });
});
//# sourceMappingURL=waimai-store.service.spec.js.map