// 租户隔离（P1-2）：履约配置的读/写/补档案不得跨渠道
import { describe, expect, it, vi } from 'vitest';
import { CampusConfigAdminResolver } from './campus-config-admin.resolver';

function make(userIsSuper: boolean, channelId = 1) {
    const stores = {
        listStoreConfigs: vi.fn().mockResolvedValue([
            { channelId: 1, channelName: 'c1' },
            { channelId: 2, channelName: 'c2' },
        ]),
        updateStoreConfig: vi.fn().mockResolvedValue({ channelId: 2 }),
    };
    const profileEnsure = { ensureDefaultShippingProfile: vi.fn().mockResolvedValue({}) };
    const svc = new CampusConfigAdminResolver(
        {} as any, {} as any, stores as any, profileEnsure as any, {} as any,
    );
    const ctx = { channelId, userHasPermissions: vi.fn().mockReturnValue(userIsSuper) } as any;
    return { svc, ctx, stores, profileEnsure };
}

describe('CampusConfigAdminResolver 租户隔离', () => {
    it('平台超管可见全部店铺配置', async () => {
        const { svc, ctx } = make(true);
        const list = await svc.campusStoreConfigs(ctx);
        expect(list).toHaveLength(2);
    });
    it('租户管理员只看到本渠道配置', async () => {
        const { svc, ctx } = make(false, 1);
        const list = await svc.campusStoreConfigs(ctx);
        expect(list.map((s: any) => s.channelId)).toEqual([1]);
    });
    it('租户管理员写其他渠道 → 拒绝且不落库', async () => {
        const { svc, ctx, stores } = make(false, 1);
        await expect(svc.campusUpdateStoreConfig(ctx, 2 as any, { routesEnabled: [] } as any))
            .rejects.toThrow('无权操作其他店铺的履约配置');
        expect(stores.updateStoreConfig).not.toHaveBeenCalled();
    });
    it('租户管理员写本渠道 → 放行', async () => {
        const { svc, ctx, stores } = make(false, 1);
        await svc.campusUpdateStoreConfig(ctx, 1 as any, { routesEnabled: [] } as any);
        expect(stores.updateStoreConfig).toHaveBeenCalledOnce();
    });
    it('平台超管可写任意渠道', async () => {
        const { svc, ctx } = make(true, 1);
        await expect(svc.campusUpdateStoreConfig(ctx, 2 as any, { routesEnabled: [] } as any)).resolves.toBeTruthy();
    });
    it('租户管理员为其他渠道补默认配送档案 → 拒绝', async () => {
        const { svc, ctx, profileEnsure } = make(false, 1);
        await expect(svc.campusEnsureDefaultShippingProfile(ctx, 2 as any))
            .rejects.toThrow('无权操作其他店铺的履约配置');
        expect(profileEnsure.ensureDefaultShippingProfile).not.toHaveBeenCalled();
    });
});
