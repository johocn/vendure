import { describe, expect, it } from 'vitest';

import { DiyOrderService } from '../diy-order.service';
import { DiyShopService } from '../diy-shop.service';
import { DiyPlan } from '../entities/diy-plan.entity';
import { DiyTemplate } from '../entities/diy-template.entity';
import { coverMaterialIds, derivePlanTitle, inferRenderPreset } from '../plan-utils';
import { DiyPlanBom, DiyPlanSpec } from '../types';

/* ------------------------- 纯函数 ------------------------- */

const spec: DiyPlanSpec = {
    slots: { main: { materialId: '11' }, accent: { materialId: '22' }, spacer: { materialId: '33' }, dup: { materialId: '11' } },
    params: { wristSize: 160 },
};
const bom: DiyPlanBom = {
    items: [
        { materialId: '11', code: 'A', name: '南红', spec: '8mm 圆珠', unitPrice: 250, qty: 18, subtotal: 4500 },
        { materialId: '22', code: 'B', name: '青金', spec: '10mm 圆珠', unitPrice: 180, qty: 3, subtotal: 540 },
    ],
    totalCount: 21,
    totalAmount: 5040,
};

describe('plan-utils', () => {
    it('coverMaterialIds：spec slots 去重取前 3', () => {
        expect(coverMaterialIds(spec)).toEqual(['11', '22', '33']);
        expect(coverMaterialIds(null)).toEqual([]);
    });

    it('derivePlanTitle：bom 素材名组合 + 手围 cm', () => {
        expect(derivePlanTitle(spec, bom)).toBe('南红青金 · 16cm');
        expect(derivePlanTitle({ slots: {}, params: {} }, bom)).toBe('南红青金');
        expect(derivePlanTitle(spec, { items: [], totalCount: 0, totalAmount: 0 })).toBe('DIY 方案');
    });

    it('inferRenderPreset：按素材名推断，缺省 matte', () => {
        expect(inferRenderPreset('南红 8mm')).toBe('matte');
        expect(inferRenderPreset('青金石 10mm')).toBe('matte');
        expect(inferRenderPreset('玛瑙隔片')).toBe('matte');
        expect(inferRenderPreset('和田玉桶珠')).toBe('jade');
        expect(inferRenderPreset('翡翠平安扣')).toBe('jade-flower');
        expect(inferRenderPreset('琉璃隔片')).toBe('glass');
        expect(inferRenderPreset('蜜蜡圆珠')).toBe('amber');
        expect(inferRenderPreset('珍珠 6mm')).toBe('pearl');
        expect(inferRenderPreset('银隔片')).toBe('metal');
        expect(inferRenderPreset('椰壳隔片')).toBe('wood');
        expect(inferRenderPreset('菩提根')).toBe('wood');
        expect(inferRenderPreset('神秘素材')).toBe('matte');
    });
});

/* ------------------------- service（假连接桩） ------------------------- */

function ctxOf(userId?: string) {
    return { activeUserId: userId, languageCode: 'zh_Hans' } as any;
}

function mkPlan(id: number, over: Partial<DiyPlan> = {}): DiyPlan {
    return Object.assign(new DiyPlan(), {
        id,
        app: 'nshop',
        userId: 1,
        status: 'draft',
        isPublic: false,
        publishedAt: null,
        templateId: 1,
        templateVersion: 1,
        calcVersion: 'test',
        spec,
        bom,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        thumb: null,
    }, over) as DiyPlan;
}

function fakeConnection(plans: DiyPlan[], opts: { template?: DiyTemplate | null } = {}) {
    let nextId = 1000;
    const planRepo = {
        async findAndCount(q: any) {
            const w = q.where ?? {};
            let rows = plans.filter(p => (w.app === undefined || p.app === w.app) && (w.isPublic === undefined || p.isPublic === w.isPublic));
            if (q.order?.publishedAt === 'DESC') {
                rows = [...rows].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
            }
            const skip = Number(q.skip ?? 0);
            const take = Number(q.take ?? 20);
            return [rows.slice(skip, skip + take), rows.length];
        },
        async findOne(q: any) {
            const w = q.where ?? {};
            const match = (p: DiyPlan) =>
                (w.app === undefined || p.app === w.app) &&
                (w.id === undefined || p.id === w.id) &&
                (w.isPublic === undefined || p.isPublic === w.isPublic);
            return plans.find(match) ?? null;
        },
        async save(row: any) {
            if (row.id == null) {
                row.id = nextId++;
                plans.push(row);
            }
            return row;
        },
    };
    const templateRepo = { findOne: async () => opts.template ?? null };
    return {
        getRepository: (_ctx: any, entity: any) => (entity === DiyPlan ? planRepo : templateRepo),
        withTransaction: (_ctx: any, fn: (c: any) => any) => fn(_ctx),
    } as any;
}

const shop = (plans: DiyPlan[]) => new DiyShopService({ app: 'nshop' } as any, fakeConnection(plans));

describe('publishDiyPlan', () => {
    it('非 owner 抛 PLAN_NOT_FOUND_OR_NOT_OWNER', async () => {
        const plans = [mkPlan(1, { userId: 7 })];
        await expect(shop(plans).publishDiyPlan(ctxOf('1'), '1', true)).rejects.toThrow('PLAN_NOT_FOUND_OR_NOT_OWNER');
    });

    it('匿名抛 ForbiddenError', async () => {
        const plans = [mkPlan(1)];
        await expect(shop(plans).publishDiyPlan(ctxOf(undefined), '1', true)).rejects.toThrow();
    });

    it('owner 发布置 publishedAt，取消置 null', async () => {
        const plans = [mkPlan(1)];
        const svc = shop(plans);
        const published = await svc.publishDiyPlan(ctxOf('1'), '1', true);
        expect(published.isPublic).toBe(true);
        expect(published.publishedAt).toBeInstanceOf(Date);
        const unpublished = await svc.publishDiyPlan(ctxOf('1'), '1', false);
        expect(unpublished.isPublic).toBe(false);
        expect(unpublished.publishedAt).toBeNull();
    });
});

describe('diyGalleryPlans', () => {
    it('只返回 isPublic=true 且按 publishedAt DESC；take 上限 50', async () => {
        const plans = [
            mkPlan(1, { isPublic: true, publishedAt: new Date('2026-03-01T00:00:00Z') }),
            mkPlan(2, { userId: 9 }),
            mkPlan(3, { isPublic: true, publishedAt: new Date('2026-02-01T00:00:00Z') }),
        ];
        const svc = shop(plans);
        const page = await svc.diyGalleryPlans(ctxOf(undefined), { take: 99 });
        expect(page.total).toBe(2);
        expect(page.items.map(i => i.id)).toEqual(['1', '3']);
        expect(page.items[0]).toMatchObject({
            title: '南红青金 · 16cm',
            coverMaterialIds: ['11', '22', '33'],
            totalAmount: 5040,
            totalCount: 21,
            authorName: null,
        });
    });
});

describe('diyPublicPlan', () => {
    it('非公开抛 PLAN_NOT_ACCESSIBLE；公开返回 spec 快照', async () => {
        const plans = [mkPlan(1), mkPlan(2, { isPublic: true, publishedAt: new Date() })];
        const svc = shop(plans);
        await expect(svc.diyPublicPlan(ctxOf(undefined), '1')).rejects.toThrow('PLAN_NOT_ACCESSIBLE');
        const pub = await svc.diyPublicPlan(ctxOf(undefined), '2');
        expect(pub.id).toBe('2');
        expect(pub.spec).toEqual(spec);
        expect(pub.totalAmount).toBe(5040);
        expect(pub.totalCount).toBe(21);
        expect(pub.title).toBe('南红青金 · 16cm');
    });
});

describe('copyDiyPlan', () => {
    it('匿名/他人非公开不可复制；公开可复制且归属当前用户、isPublic=false', async () => {
        const plans = [mkPlan(1, { userId: 7 }), mkPlan(2, { userId: 7, isPublic: true, publishedAt: new Date() })];
        const svc = shop(plans);
        await expect(svc.copyDiyPlan(ctxOf(undefined), '1')).rejects.toThrow();
        await expect(svc.copyDiyPlan(ctxOf('1'), '1')).rejects.toThrow('PLAN_NOT_ACCESSIBLE');
        const copy = await svc.copyDiyPlan(ctxOf('1'), '2');
        expect(copy.userId).toBe(1);
        expect(copy.status).toBe('draft');
        expect(copy.isPublic).toBe(false);
        expect(copy.publishedAt).toBeNull();
        expect(copy.spec).toEqual(spec);
        expect(copy.bom.totalAmount).toBe(5040);
        expect(copy.templateId).toBe(1);
    });

    it('owner 复制自己的方案同样回到 draft 私有副本', async () => {
        const plans = [mkPlan(1, { isPublic: true, publishedAt: new Date() })];
        const copy = await shop(plans).copyDiyPlan(ctxOf('1'), '1');
        expect(copy.userId).toBe(1);
        expect(copy.id).not.toBe(1);
        expect(copy.isPublic).toBe(false);
        expect(copy.status).toBe('draft');
    });
});

describe('createOrderFromPlan 归属门槛放宽', () => {
    function orderSvc(plans: DiyPlan[]) {
        const conn = fakeConnection(plans);
        return new DiyOrderService({ app: 'nshop' } as any, conn, {} as any, {} as any, {} as any);
    }

    it('他人非公开方案：归属拒绝（Diy plan not found）', async () => {
        const plans = [mkPlan(1, { userId: 7 })];
        await expect(orderSvc(plans).createOrderFromPlan(ctxOf('1'), '1')).rejects.toThrow('Diy plan not found');
    });

    it('他人公开方案：过归属门槛（走到模板校验才失败）', async () => {
        const plans = [mkPlan(2, { userId: 7, isPublic: true, publishedAt: new Date() })];
        // 模板缺失 → 过了归属检查后抛 'Diy template not available'，证明门槛已放宽
        await expect(orderSvc(plans).createOrderFromPlan(ctxOf('1'), '2')).rejects.toThrow('Diy template not available');
    });
});
