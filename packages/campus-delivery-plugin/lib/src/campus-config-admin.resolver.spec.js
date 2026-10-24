"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 租户隔离（P1-2）：履约配置的读/写/补档案不得跨渠道
const vitest_1 = require("vitest");
const campus_config_admin_resolver_1 = require("./campus-config-admin.resolver");
function make(userIsSuper, channelId = 1) {
    const stores = {
        listStoreConfigs: vitest_1.vi.fn().mockResolvedValue([
            { channelId: 1, channelName: 'c1' },
            { channelId: 2, channelName: 'c2' },
        ]),
        updateStoreConfig: vitest_1.vi.fn().mockResolvedValue({ channelId: 2 }),
    };
    const profileEnsure = { ensureDefaultShippingProfile: vitest_1.vi.fn().mockResolvedValue({}) };
    const svc = new campus_config_admin_resolver_1.CampusConfigAdminResolver({}, {}, stores, profileEnsure, {});
    const ctx = { channelId, userHasPermissions: vitest_1.vi.fn().mockReturnValue(userIsSuper) };
    return { svc, ctx, stores, profileEnsure };
}
(0, vitest_1.describe)('CampusConfigAdminResolver 租户隔离', () => {
    (0, vitest_1.it)('平台超管可见全部店铺配置', async () => {
        const { svc, ctx } = make(true);
        const list = await svc.campusStoreConfigs(ctx);
        (0, vitest_1.expect)(list).toHaveLength(2);
    });
    (0, vitest_1.it)('租户管理员只看到本渠道配置', async () => {
        const { svc, ctx } = make(false, 1);
        const list = await svc.campusStoreConfigs(ctx);
        (0, vitest_1.expect)(list.map((s) => s.channelId)).toEqual([1]);
    });
    (0, vitest_1.it)('租户管理员写其他渠道 → 拒绝且不落库', async () => {
        const { svc, ctx, stores } = make(false, 1);
        await (0, vitest_1.expect)(svc.campusUpdateStoreConfig(ctx, 2, { routesEnabled: [] }))
            .rejects.toThrow('无权操作其他店铺的履约配置');
        (0, vitest_1.expect)(stores.updateStoreConfig).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('租户管理员写本渠道 → 放行', async () => {
        const { svc, ctx, stores } = make(false, 1);
        await svc.campusUpdateStoreConfig(ctx, 1, { routesEnabled: [] });
        (0, vitest_1.expect)(stores.updateStoreConfig).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('平台超管可写任意渠道', async () => {
        const { svc, ctx } = make(true, 1);
        await (0, vitest_1.expect)(svc.campusUpdateStoreConfig(ctx, 2, { routesEnabled: [] })).resolves.toBeTruthy();
    });
    (0, vitest_1.it)('租户管理员为其他渠道补默认配送档案 → 拒绝', async () => {
        const { svc, ctx, profileEnsure } = make(false, 1);
        await (0, vitest_1.expect)(svc.campusEnsureDefaultShippingProfile(ctx, 2))
            .rejects.toThrow('无权操作其他店铺的履约配置');
        (0, vitest_1.expect)(profileEnsure.ensureDefaultShippingProfile).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=campus-config-admin.resolver.spec.js.map