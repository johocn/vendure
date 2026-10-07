"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/core");
const vitest_1 = require("vitest");
const waimai_store_service_1 = require("./waimai-store.service");
function makeEnv(opts = {}) {
    var _a, _b;
    const repoByEntity = {
        CampusFulfillmentConfig: {
            find: vitest_1.vi.fn().mockResolvedValue((_a = opts.configs) !== null && _a !== void 0 ? _a : []),
            findOne: vitest_1.vi.fn(),
            save: vitest_1.vi.fn(async (x) => x),
        },
        Channel: {
            find: vitest_1.vi.fn().mockResolvedValue((_b = opts.channels) !== null && _b !== void 0 ? _b : []),
            findOne: vitest_1.vi.fn(),
        },
    };
    const conn = { getRepository: vitest_1.vi.fn((_ctx, ent) => { var _a; return repoByEntity[(_a = ent.name) !== null && _a !== void 0 ? _a : String(ent)]; }) };
    // 默认桩：updateStoreConfig 带 storeAddress 时会走 R4 自提点 upsert（rawConnection），既有用例不对其断言
    conn.rawConnection = {
        getRepository: vitest_1.vi.fn(() => ({ findOne: vitest_1.vi.fn().mockResolvedValue(undefined), save: vitest_1.vi.fn(async (x) => x) })),
    };
    return { svc: new waimai_store_service_1.WaimaiStoreService(conn), repoByEntity };
}
(0, vitest_1.describe)('WaimaiStoreService.listStores', () => {
    (0, vitest_1.it)('仅返回有履约配置的渠道并解析 tags，新 6 字段从配置透出', async () => {
        const env = makeEnv({
            configs: [
                { channelId: 1, paused: false, routesEnabled: ['R3'] }, // 默认渠道脏配置：应被跳过
                { channelId: 2, paused: false, routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢', errandBaseFee: 300, freeShippingThreshold: 1800 },
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
            deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200,
            storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢',
            errandBaseFee: 300,
            freeShippingThreshold: 1800,
        });
    });
    (0, vitest_1.it)('空 tags/缺月售/缺新字段容错（全 null），paused 透传', async () => {
        const env = makeEnv({
            configs: [{ channelId: 9, paused: true, routesEnabled: [] }],
            channels: [{ id: 9, token: 'x', code: 'x店', customFields: {} }],
        });
        const list = await env.svc.listStores({});
        (0, vitest_1.expect)(list[0].tags).toEqual([]);
        (0, vitest_1.expect)(list[0].monthlySales).toBe(0);
        (0, vitest_1.expect)(list[0].promoText).toBeNull();
        (0, vitest_1.expect)(list[0].paused).toBe(true);
        (0, vitest_1.expect)(list[0].deliveryMinutes).toBeNull();
        (0, vitest_1.expect)(list[0].minOrderAmount).toBeNull();
        (0, vitest_1.expect)(list[0].deliveryFee).toBeNull();
        (0, vitest_1.expect)(list[0].storeAddress).toBeNull();
        (0, vitest_1.expect)(list[0].storePhone).toBeNull();
        (0, vitest_1.expect)(list[0].storeNotice).toBeNull();
        (0, vitest_1.expect)(list[0].errandBaseFee).toBeNull();
    });
});
(0, vitest_1.describe)('WaimaiStoreService.listStoreConfigs', () => {
    (0, vitest_1.it)('全渠道输出（默认渠道跳过），无配置行店铺 routesEnabled=[] 且 6 字段全 null', async () => {
        const env = makeEnv({
            configs: [{ channelId: 2, paused: false, routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢' }],
            channels: [
                { id: 1, token: 'default', code: '__default_channel__' },
                { id: 2, token: 'canteen', code: '一食堂麻辣香锅' },
                { id: 3, token: 'milktea', code: '奶茶铺' },
            ],
        });
        const list = await env.svc.listStoreConfigs({});
        (0, vitest_1.expect)(list).toHaveLength(2);
        (0, vitest_1.expect)(list[0]).toEqual({
            channelId: 2, channelName: '一食堂麻辣香锅', channelToken: 'canteen',
            routesEnabled: ['R1', 'R3'],
            deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200,
            storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢',
            errandBaseFee: null,
            freeShippingThreshold: null,
            notifyTemplateAccepted: null, notifyTemplateRiderAssigned: null,
            notifyTemplateCookingDone: null, notifyTemplateDelivered: null,
            notifyTemplateExceptionHandled: null,
        });
        (0, vitest_1.expect)(list[1]).toEqual({
            channelId: 3, channelName: '奶茶铺', channelToken: 'milktea',
            routesEnabled: [],
            deliveryMinutes: null, minOrderAmount: null, deliveryFee: null,
            storeAddress: null, storePhone: null, storeNotice: null,
            errandBaseFee: null,
            freeShippingThreshold: null,
            notifyTemplateAccepted: null, notifyTemplateRiderAssigned: null,
            notifyTemplateCookingDone: null, notifyTemplateDelivered: null,
            notifyTemplateExceptionHandled: null,
        });
    });
});
(0, vitest_1.describe)('WaimaiStoreService.updateStoreConfig', () => {
    (0, vitest_1.it)('无配置行则创建（upsert 幂等）：同 channelId 二次调用更新不新增行', async () => {
        const env = makeEnv({
            channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }],
        });
        const cfgRepo = env.repoByEntity.CampusFulfillmentConfig;
        cfgRepo.findOne.mockResolvedValueOnce(undefined); // 第一次：无行
        cfgRepo.findOne.mockResolvedValueOnce({ channelId: 2, routesEnabled: ['R1'] }); // 第二次：已有行
        const input = { routesEnabled: ['R1', 'R3'], deliveryMinutes: 35, minOrderAmount: 1500, deliveryFee: 200, storeAddress: '东门 1 号楼', storePhone: '13800000000', storeNotice: '周末出餐慢' };
        await env.svc.updateStoreConfig({}, 2, input);
        await env.svc.updateStoreConfig({}, 2, Object.assign(Object.assign({}, input), { routesEnabled: ['R3'] }));
        (0, vitest_1.expect)(cfgRepo.save).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(cfgRepo.findOne).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)('白名单校验：routesEnabled 含 R9 抛 UserInputError，不落库', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }] });
        const cfgRepo = env.repoByEntity.CampusFulfillmentConfig;
        cfgRepo.findOne.mockResolvedValue({ channelId: 2, routesEnabled: ['R1'] });
        await (0, vitest_1.expect)(env.svc.updateStoreConfig({}, 2, { routesEnabled: ['R1', 'R9'] }))
            .rejects.toThrow(core_1.UserInputError);
        (0, vitest_1.expect)(cfgRepo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('金额/时长负数拒绝', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }] });
        env.repoByEntity.CampusFulfillmentConfig.findOne.mockResolvedValue({ channelId: 2, routesEnabled: ['R1'] });
        await (0, vitest_1.expect)(env.svc.updateStoreConfig({}, 2, { routesEnabled: ['R1'], minOrderAmount: -1 }))
            .rejects.toThrow(core_1.UserInputError);
        await (0, vitest_1.expect)(env.svc.updateStoreConfig({}, 2, { routesEnabled: ['R1'], deliveryFee: -5 }))
            .rejects.toThrow(core_1.UserInputError);
        await (0, vitest_1.expect)(env.svc.updateStoreConfig({}, 2, { routesEnabled: ['R1'], deliveryMinutes: -10 }))
            .rejects.toThrow(core_1.UserInputError);
    });
    (0, vitest_1.it)('渠道不存在抛 UserInputError', async () => {
        const env = makeEnv({});
        env.repoByEntity.Channel.findOne.mockResolvedValue(undefined);
        await (0, vitest_1.expect)(env.svc.updateStoreConfig({}, 99, { routesEnabled: ['R1'] }))
            .rejects.toThrow(core_1.UserInputError);
    });
    (0, vitest_1.it)('成功保存后返回 WithChannel 视图', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅' }] });
        env.repoByEntity.CampusFulfillmentConfig.findOne.mockResolvedValue({ channelId: 2, routesEnabled: ['R1'] });
        const out = await env.svc.updateStoreConfig({}, 2, { routesEnabled: ['R2'], storeNotice: '公告' });
        (0, vitest_1.expect)(out).toEqual({
            channelId: 2, channelName: '一食堂麻辣香锅', channelToken: 'canteen',
            routesEnabled: ['R2'],
            deliveryMinutes: null, minOrderAmount: null, deliveryFee: null,
            storeAddress: null, storePhone: null, storeNotice: '公告',
            errandBaseFee: null,
            freeShippingThreshold: null,
            notifyTemplateAccepted: null, notifyTemplateRiderAssigned: null,
            notifyTemplateCookingDone: null, notifyTemplateDelivered: null,
            notifyTemplateExceptionHandled: null,
        });
    });
});
(0, vitest_1.describe)('WaimaiStoreService.updateStoreConfig errandBaseFee', () => {
    (0, vitest_1.it)('errandBaseFee 负数拒绝', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        await (0, vitest_1.expect)(env.svc.updateStoreConfig({}, 2, {
            routesEnabled: ['R1'], errandBaseFee: -1,
        })).rejects.toThrow('不能为负数');
    });
    (0, vitest_1.it)('errandBaseFee 持久化并回读', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        const out = await env.svc.updateStoreConfig({}, 2, {
            routesEnabled: ['R5'], errandBaseFee: 300,
        });
        (0, vitest_1.expect)(out.errandBaseFee).toBe(300);
    });
});
(0, vitest_1.describe)('WaimaiStoreService.updateStoreConfig freeShippingThreshold（plan 3.2）', () => {
    (0, vitest_1.it)('负数拒绝', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        await (0, vitest_1.expect)(env.svc.updateStoreConfig({}, 2, {
            routesEnabled: ['R1'], freeShippingThreshold: -100,
        })).rejects.toThrow('不能为负数');
    });
    (0, vitest_1.it)('持久化并回读（null=不启用）', async () => {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂', customFields: {} }] });
        const out = await env.svc.updateStoreConfig({}, 2, {
            routesEnabled: ['R1'], freeShippingThreshold: 1800,
        });
        (0, vitest_1.expect)(out.freeShippingThreshold).toBe(1800);
        const off = await env.svc.updateStoreConfig({}, 2, {
            routesEnabled: ['R1'], freeShippingThreshold: null,
        });
        (0, vitest_1.expect)(off.freeShippingThreshold).toBeNull();
    });
});
(0, vitest_1.describe)('WaimaiStoreService R4 store pickup location upsert', () => {
    function makeLocEnv(locRepo) {
        const env = makeEnv({ channels: [{ id: 2, token: 'canteen', code: '一食堂麻辣香锅', customFields: {} }] });
        env.svc.connection.rawConnection = {
            getRepository: vitest_1.vi.fn(() => locRepo),
        };
        return env;
    }
    (0, vitest_1.it)('storeAddress 非空：新建自提点（type=store, remark=campus-r4, 绑渠道）', async () => {
        const locRepo = {
            findOne: vitest_1.vi.fn().mockResolvedValue(null),
            save: vitest_1.vi.fn(async (x) => (Object.assign({ id: 55 }, x))),
        };
        const env = makeLocEnv(locRepo);
        await env.svc.updateStoreConfig({}, 2, {
            routesEnabled: ['R4'], storeAddress: '东门 1 号楼', storePhone: '13800000000',
        });
        (0, vitest_1.expect)(locRepo.save).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            name: '一食堂麻辣香锅', address: '东门 1 号楼', phoneNumber: '13800000000',
            type: 'store', ownerChannelId: 2, remark: 'campus-r4', channels: [{ id: 2 }],
        }));
    });
    (0, vitest_1.it)('已存在：更新地址不新建', async () => {
        const locRepo = {
            findOne: vitest_1.vi.fn().mockResolvedValue({ id: 55, name: '旧名', address: '旧址', phoneNumber: null, remark: 'campus-r4' }),
            save: vitest_1.vi.fn(async (x) => x),
        };
        const env = makeLocEnv(locRepo);
        await env.svc.updateStoreConfig({}, 2, {
            routesEnabled: ['R4'], storeAddress: '新址', storePhone: null,
        });
        (0, vitest_1.expect)(locRepo.save).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ id: 55, address: '新址' }));
    });
    (0, vitest_1.it)('storeAddress 清空：跳过 upsert（不删除既有记录）', async () => {
        const locRepo = {
            findOne: vitest_1.vi.fn(), save: vitest_1.vi.fn(),
        };
        const env = makeLocEnv(locRepo);
        await env.svc.updateStoreConfig({}, 2, { routesEnabled: ['R4'], storeAddress: null });
        (0, vitest_1.expect)(locRepo.findOne).not.toHaveBeenCalled();
        (0, vitest_1.expect)(locRepo.save).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=waimai-store.service.spec.js.map