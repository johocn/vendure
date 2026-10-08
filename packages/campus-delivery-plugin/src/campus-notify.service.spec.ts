import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { CampusNotifyService } from './campus-notify.service';

/** 用户侧节点通知（经 zhao-sso 服务间 API）：fire-and-forget 语义（未配置/无 ssoId/发送失败均不上抛） */
describe('CampusNotifyService', () => {
    const makeCtx = () => ({ channelId: 7 } as any);
    const ENV = {
        SSO_NOTIFY_BASE_URL: 'https://h.joho.cn/api/zhao-sso',
        SSO_NOTIFY_APP_CODE: 'vendure-youshop',
        SSO_NOTIFY_APP_SECRET: 'sec-xyz',
    };

    const ORDER = {
        code: 'ORD1',
        totalWithTax: 1900,
        lines: [{ productVariant: { name: '拿铁' } }, { productVariant: { name: '三明治' } }],
    };

    function makeSvc(opts: { templateCode?: string | null; ssoId?: string | null }) {
        const findOne = vi.fn().mockResolvedValue(
            opts.ssoId === null
                ? { ...ORDER, customer: { customFields: { wechatOpenid: 'o-123' } } }
                : { ...ORDER, customer: { customFields: { ssoId: opts.ssoId ?? '3' } } },
        );
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { job: { id: 9, status: 'sent' } } }),
        });
        vi.stubGlobal('fetch', fetchMock);
        const svc = new CampusNotifyService(
            { getRepository: () => ({ findOne }) } as any,
            {
                getConfig: vi.fn().mockResolvedValue({
                    notifyTemplateAccepted: opts.templateCode ?? null,
                    notifyTemplateRiderAssigned: opts.templateCode ?? null,
                    notifyTemplateCookingDone: opts.templateCode ?? null,
                    notifyTemplateDelivered: opts.templateCode ?? null,
                    notifyTemplateExceptionHandled: opts.templateCode ?? null,
                    notifyTemplateOrderPlaced: opts.templateCode ?? null,
                    notifyTemplatePaymentPending: opts.templateCode ?? null,
                    notifyTemplateCancelled: opts.templateCode ?? null,
                    notifyTemplateAfterSales: opts.templateCode ?? null,
                }),
            } as any,
        );
        return { svc, findOne, fetchMock };
    }

    beforeEach(() => {
        for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('env 未配置 → 跳过（不查订单不调 API）', async () => {
        vi.stubEnv('SSO_NOTIFY_BASE_URL', '');
        const { svc, findOne, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vi.waitFor(() => expect(findOne).not.toHaveBeenCalled());
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('未配置模板 → 跳过（不查订单不调 API）', async () => {
        const { svc, findOne, fetchMock } = makeSvc({ templateCode: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vi.waitFor(() => expect(findOne).not.toHaveBeenCalled());
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('customer 无 ssoId（仅 wechatOpenid）→ 跳过调用', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created', ssoId: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vi.waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
    });

    it('履约节点（amount 型模板）→ params 含 itemName/amount/payMethod', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created', ssoId: '3' });
        svc.user(makeCtx(), 1, 'cookingDone');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://h.joho.cn/api/zhao-sso/v1/msg/template-send');
        expect(init.method).toBe('POST');
        const body = JSON.parse(init.body);
        expect(body.app_code).toBe('vendure-youshop');
        expect(body.app_secret).toBe('sec-xyz');
        expect(body.sso_user_id).toBe(3);
        expect(body.template_code).toBe('waimai_order_created');
        expect(body.params).toEqual({
            orderCode: 'ORD1',
            itemName: '拿铁 等2件',
            amount: '19.00',
            payMethod: '在线支付',
        });
        expect(body.dedupe_key).toBe('campus:cookingDone:1');
    });

    it('SSO 返回非 2xx → 静默吞掉（不 unhandledRejection）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'app_secret 验证失败' }) });
        svc.user(makeCtx(), 1, 'orderDelivered');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        await new Promise(r => setTimeout(r, 10));
    });

    it('exceptionHandled：text 动态文案 → afterSaleType 截 5 字符（phrase 占位符）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_after_sales' });
        svc.user(makeCtx(), 2, 'exceptionHandled', '订单已全额退款');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.params).toEqual({
            orderCode: 'ORD1',
            itemName: '拿铁 等2件',
            afterSaleType: '订单已全额',
        });
    });

    it('orderCancelled → refundAmount 型 params', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_cancelled' });
        svc.user(makeCtx(), 3, 'orderCancelled');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.params).toEqual({
            orderCode: 'ORD1',
            itemName: '拿铁 等2件',
            refundAmount: '19.00',
        });
        expect(body.dedupe_key).toBe('campus:orderCancelled:3');
    });

    it('配置 h5BaseUrl → link 指向 H5 订单详情（跳转落地页）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        (svc as any).user(makeCtx(), 1, 'orderPlaced', undefined, 'https://www.yourbao.cn');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.link).toBe('https://www.yourbao.cn/#/pkg-order/pages/order-detail?code=ORD1');
    });

    // F7 进程内重试：首发失败退避 2s/8s 重发（dedupe_key 幂等，重发不产生重复消息）
    it('F7：首发失败 → 退避 2s 后第 2 次重试成功（共 2 次调用）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        fetchMock
            .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { job: { id: 9, status: 'sent' } } }) });
        vi.useFakeTimers();
        try {
            svc.user(makeCtx(), 1, 'orderAccepted');
            await vi.advanceTimersByTimeAsync(2100); // 首发失败 + 2s 退避 + 重试
            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('F7：三次全失败 → 共 3 次调用后放弃（静默，不 unhandledRejection）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'down' }) });
        vi.useFakeTimers();
        try {
            svc.user(makeCtx(), 1, 'orderAccepted');
            await vi.advanceTimersByTimeAsync(3000);
            await vi.advanceTimersByTimeAsync(9000); // 2s + 8s 退避走完
            expect(fetchMock).toHaveBeenCalledTimes(3);
        } finally {
            vi.useRealTimers();
        }
    });
});
