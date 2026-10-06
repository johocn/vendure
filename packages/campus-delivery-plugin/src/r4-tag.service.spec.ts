import { beforeEach, describe, expect, it, vi } from 'vitest';
import { R4TagService } from './r4-tag.service';

function makeEvent(opts: { toState: string; route?: string | null; methodCode?: string | null; channelCampus?: boolean }) {
    return {
        ctx: { channelId: 2 } as any,
        order: { id: '9', code: 'TEST01', customFields: { fulfillmentRoute: opts.route ?? null } } as any,
        toState: opts.toState,
    } as any;
}

function makeSvc(opts: { methodCode?: string | null }) {
    const updateCustomFields = vi.fn().mockResolvedValue({});
    const svc = new R4TagService(
        { getRepository: vi.fn(() => ({ findOne: vi.fn().mockResolvedValue({ channelId: 2 }) })) } as any,
        {
            hydrate: vi.fn().mockResolvedValue({
                shippingLines: opts.methodCode == null ? [] : [{ shippingMethod: { code: opts.methodCode } }],
            }),
        } as any,
        { updateCustomFields } as any,
    );
    return { svc, updateCustomFields };
}

describe('R4TagService', () => {
    beforeEach(() => vi.clearAllMocks());

    it('非 ArrangingPayment 过渡不打标', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'store-pickup' });
        await svc.tagR4(makeEvent({ toState: 'PaymentAuthorized', methodCode: 'store-pickup' }));
        expect(updateCustomFields).not.toHaveBeenCalled();
    });

    it('已有路线（R1/R2/R3/R5）不打标', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'store-pickup' });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', route: 'R3', methodCode: 'store-pickup' }));
        expect(updateCustomFields).not.toHaveBeenCalled();
    });

    it('store-pickup 运费方式 → 打标 R4', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'store-pickup' });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', methodCode: 'store-pickup' }));
        expect(updateCustomFields).toHaveBeenCalledWith(expect.anything(), '9', { fulfillmentRoute: 'R4' });
    });

    it('非 store-pickup 运费方式不打标（R1/R3 等 campus 配送）', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: 'campus-errand-standard' });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', methodCode: 'campus-errand-standard' }));
        expect(updateCustomFields).not.toHaveBeenCalled();
    });

    it('无配送行不打标', async () => {
        const { svc, updateCustomFields } = makeSvc({ methodCode: null });
        await svc.tagR4(makeEvent({ toState: 'ArrangingPayment', methodCode: null }));
        expect(updateCustomFields).not.toHaveBeenCalled();
    });
});
