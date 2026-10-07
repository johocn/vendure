"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const campus_notify_service_1 = require("./campus-notify.service");
/** 用户侧节点通知（经 zhao-sso 服务间 API）：fire-and-forget 语义（未配置/无 ssoId/发送失败均不上抛） */
(0, vitest_1.describe)('CampusNotifyService', () => {
    const makeCtx = () => ({ channelId: 7 });
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
    function makeSvc(opts) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const findOne = vitest_1.vi.fn().mockResolvedValue(opts.ssoId === null
            ? Object.assign(Object.assign({}, ORDER), { customer: { customFields: { wechatOpenid: 'o-123' } } }) : Object.assign(Object.assign({}, ORDER), { customer: { customFields: { ssoId: (_a = opts.ssoId) !== null && _a !== void 0 ? _a : '3' } } }));
        const fetchMock = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { job: { id: 9, status: 'sent' } } }),
        });
        vitest_1.vi.stubGlobal('fetch', fetchMock);
        const svc = new campus_notify_service_1.CampusNotifyService({ getRepository: () => ({ findOne }) }, {
            getConfig: vitest_1.vi.fn().mockResolvedValue({
                notifyTemplateAccepted: (_b = opts.templateCode) !== null && _b !== void 0 ? _b : null,
                notifyTemplateRiderAssigned: (_c = opts.templateCode) !== null && _c !== void 0 ? _c : null,
                notifyTemplateCookingDone: (_d = opts.templateCode) !== null && _d !== void 0 ? _d : null,
                notifyTemplateDelivered: (_e = opts.templateCode) !== null && _e !== void 0 ? _e : null,
                notifyTemplateExceptionHandled: (_f = opts.templateCode) !== null && _f !== void 0 ? _f : null,
                notifyTemplateOrderPlaced: (_g = opts.templateCode) !== null && _g !== void 0 ? _g : null,
                notifyTemplatePaymentPending: (_h = opts.templateCode) !== null && _h !== void 0 ? _h : null,
                notifyTemplateCancelled: (_j = opts.templateCode) !== null && _j !== void 0 ? _j : null,
                notifyTemplateAfterSales: (_k = opts.templateCode) !== null && _k !== void 0 ? _k : null,
            }),
        });
        return { svc, findOne, fetchMock };
    }
    (0, vitest_1.beforeEach)(() => {
        for (const [k, v] of Object.entries(ENV))
            vitest_1.vi.stubEnv(k, v);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.unstubAllEnvs();
        vitest_1.vi.unstubAllGlobals();
    });
    (0, vitest_1.it)('env 未配置 → 跳过（不查订单不调 API）', async () => {
        vitest_1.vi.stubEnv('SSO_NOTIFY_BASE_URL', '');
        const { svc, findOne, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(findOne).not.toHaveBeenCalled());
        (0, vitest_1.expect)(fetchMock).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('未配置模板 → 跳过（不查订单不调 API）', async () => {
        const { svc, findOne, fetchMock } = makeSvc({ templateCode: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(findOne).not.toHaveBeenCalled());
        (0, vitest_1.expect)(fetchMock).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('customer 无 ssoId（仅 wechatOpenid）→ 跳过调用', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created', ssoId: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchMock).not.toHaveBeenCalled());
    });
    (0, vitest_1.it)('履约节点（amount 型模板）→ params 含 itemName/amount/payMethod', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created', ssoId: '3' });
        svc.user(makeCtx(), 1, 'cookingDone');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchMock).toHaveBeenCalled());
        const [url, init] = fetchMock.mock.calls[0];
        (0, vitest_1.expect)(url).toBe('https://h.joho.cn/api/zhao-sso/v1/msg/template-send');
        (0, vitest_1.expect)(init.method).toBe('POST');
        const body = JSON.parse(init.body);
        (0, vitest_1.expect)(body.app_code).toBe('vendure-youshop');
        (0, vitest_1.expect)(body.app_secret).toBe('sec-xyz');
        (0, vitest_1.expect)(body.sso_user_id).toBe(3);
        (0, vitest_1.expect)(body.template_code).toBe('waimai_order_created');
        (0, vitest_1.expect)(body.params).toEqual({
            orderCode: 'ORD1',
            itemName: '拿铁 等2件',
            amount: '19.00',
            payMethod: '在线支付',
        });
        (0, vitest_1.expect)(body.dedupe_key).toBe('campus:cookingDone:1');
    });
    (0, vitest_1.it)('SSO 返回非 2xx → 静默吞掉（不 unhandledRejection）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'app_secret 验证失败' }) });
        svc.user(makeCtx(), 1, 'orderDelivered');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchMock).toHaveBeenCalled());
        await new Promise(r => setTimeout(r, 10));
    });
    (0, vitest_1.it)('exceptionHandled：text 动态文案 → afterSaleType 截 5 字符（phrase 占位符）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_after_sales' });
        svc.user(makeCtx(), 2, 'exceptionHandled', '订单已全额退款');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.params).toEqual({
            orderCode: 'ORD1',
            itemName: '拿铁 等2件',
            afterSaleType: '订单已全额',
        });
    });
    (0, vitest_1.it)('orderCancelled → refundAmount 型 params', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_cancelled' });
        svc.user(makeCtx(), 3, 'orderCancelled');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.params).toEqual({
            orderCode: 'ORD1',
            itemName: '拿铁 等2件',
            refundAmount: '19.00',
        });
        (0, vitest_1.expect)(body.dedupe_key).toBe('campus:orderCancelled:3');
    });
    (0, vitest_1.it)('配置 h5BaseUrl → link 指向 H5 订单详情（跳转落地页）', async () => {
        const { svc, fetchMock } = makeSvc({ templateCode: 'waimai_order_created' });
        svc.user(makeCtx(), 1, 'orderPlaced', undefined, 'https://www.yourbao.cn');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        (0, vitest_1.expect)(body.link).toBe('https://www.yourbao.cn/#/pkg-order/pages/order-detail?code=ORD1');
    });
});
//# sourceMappingURL=campus-notify.service.spec.js.map