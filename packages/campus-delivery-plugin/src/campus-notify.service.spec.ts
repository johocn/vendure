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

    function makeSvc(opts: { templateCode?: string | null; ssoId?: string | null }) {
        const findOne = vi.fn().mockResolvedValue(
            opts.ssoId === null
                ? { code: 'ORD1', customer: { customFields: { wechatOpenid: 'o-123' } } }
                : { code: 'ORD1', customer: { customFields: { ssoId: opts.ssoId ?? '3' } } },
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

    it('配置 + ssoId → POST template-send（鉴权/目标/模板/params/dedupe_key）', async () => {
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
        expect(body.params.orderCode).toBe('ORD1');
        expect(body.params.status).toBe('出餐完成，等待取货');
        expect(body.params.time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
        expect(body.dedupe_key).toBe('campus:cookingDone:1');
    });

    it('SSO 返回非 2xx → 静默吞掉（不 unhandledRejection）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'app_secret 验证失败' }) });
        svc.user(makeCtx(), 1, 'orderDelivered');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        await new Promise(r => setTimeout(r, 10));
    });

    it('exceptionHandled：动态文案覆盖 status（处置结果）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_after_sales' });
        svc.user(makeCtx(), 2, 'exceptionHandled', '订单已全额退款');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.params.status).toBe('订单已全额退款');
    });

    it('配置 h5BaseUrl → link 指向 H5 订单详情（跳转落地页）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        (svc as any).user(makeCtx(), 1, 'orderPlaced', undefined, 'https://www.yourbao.cn');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.link).toBe('https://www.yourbao.cn/#/pkg-order/pages/order-detail?code=ORD1');
    });
});
