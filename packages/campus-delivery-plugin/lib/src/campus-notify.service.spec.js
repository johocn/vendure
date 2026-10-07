"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const campus_notify_service_1 = require("./campus-notify.service");
/** 用户侧节点通知：fire-and-forget 语义（未配置/无 openid/发送失败均不上抛） */
(0, vitest_1.describe)('CampusNotifyService', () => {
    const makeCtx = () => ({ channelId: 7 });
    function makeSvc(opts) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const findOne = vitest_1.vi.fn().mockResolvedValue(opts.openid === null
            ? { code: 'ORD1', customer: { customFields: { wechatMiniOpenid: 'mini-x' } } }
            : { code: 'ORD1', customer: { customFields: { wechatOpenid: 'o-123' } } });
        const sendTemplate = vitest_1.vi.fn().mockImplementation(async () => {
            if (opts.sendErr)
                throw opts.sendErr;
            return { errcode: 0, msgid: 1001 };
        });
        const svc = new campus_notify_service_1.CampusNotifyService({ getRepository: () => ({ findOne }) }, {
            getConfig: vitest_1.vi.fn().mockResolvedValue({
                notifyTemplateAccepted: (_a = opts.templateId) !== null && _a !== void 0 ? _a : null,
                notifyTemplateRiderAssigned: (_b = opts.templateId) !== null && _b !== void 0 ? _b : null,
                notifyTemplateCookingDone: (_c = opts.templateId) !== null && _c !== void 0 ? _c : null,
                notifyTemplateDelivered: (_d = opts.templateId) !== null && _d !== void 0 ? _d : null,
                notifyTemplateExceptionHandled: (_e = opts.templateId) !== null && _e !== void 0 ? _e : null,
                notifyTemplateOrderPlaced: (_f = opts.templateId) !== null && _f !== void 0 ? _f : null,
                notifyTemplatePaymentPending: (_g = opts.templateId) !== null && _g !== void 0 ? _g : null,
                notifyTemplateCancelled: (_h = opts.templateId) !== null && _h !== void 0 ? _h : null,
                notifyTemplateAfterSales: (_j = opts.templateId) !== null && _j !== void 0 ? _j : null,
            }),
        }, { get: vitest_1.vi.fn().mockReturnValue({ sendTemplate }) });
        return { svc, findOne, sendTemplate };
    }
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('未配置模板 → 跳过（不查订单不发送）', async () => {
        const { svc, findOne, sendTemplate } = makeSvc({ templateId: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(findOne).not.toHaveBeenCalled());
        (0, vitest_1.expect)(sendTemplate).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('用户无公众号 openid（仅小程序 openid）→ 跳过发送', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendTemplate).not.toHaveBeenCalled());
    });
    (0, vitest_1.it)('配置 + openid → sendTemplate 收到映射数据（订单号/状态/时间）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 1, 'cookingDone');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendTemplate).toHaveBeenCalled());
        const arg = sendTemplate.mock.calls[0][0];
        (0, vitest_1.expect)(arg.touser).toBe('o-123');
        (0, vitest_1.expect)(arg.template_id).toBe('TID');
        (0, vitest_1.expect)(arg.data.character_string1.value).toBe('ORD1');
        (0, vitest_1.expect)(arg.data.thing1.value).toBe('出餐完成，等待取货');
        (0, vitest_1.expect)(arg.data.time2.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
    (0, vitest_1.it)('发送抛错 → 静默吞掉（不 unhandledRejection）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123', sendErr: new Error('wx down') });
        svc.user(makeCtx(), 1, 'orderDelivered');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendTemplate).toHaveBeenCalled());
        // fire-and-forget promise 已内部消化
        await new Promise(r => setTimeout(r, 10));
    });
    (0, vitest_1.it)('exceptionHandled：动态文案覆盖 thing1（处置结果 push，plan 3.4 补全）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 2, 'exceptionHandled', '订单已全额退款');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendTemplate).toHaveBeenCalled());
        const arg = sendTemplate.mock.calls[0][0];
        (0, vitest_1.expect)(arg.data.thing1.value).toBe('订单已全额退款');
    });
    (0, vitest_1.it)('orderPlaced：映射 thing1=订单支付成功，商家接单中', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 1, 'orderPlaced');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendTemplate).toHaveBeenCalled());
        (0, vitest_1.expect)(sendTemplate.mock.calls[0][0].data.thing1.value).toBe('订单支付成功，商家接单中');
    });
    (0, vitest_1.it)('paymentPending / orderCancelled / afterSales 文案映射', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 1, 'paymentPending');
        svc.user(makeCtx(), 1, 'orderCancelled', '订单超时未支付，已自动取消');
        svc.user(makeCtx(), 1, 'afterSales', '退款已到账');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendTemplate).toHaveBeenCalledTimes(3));
        const things = sendTemplate.mock.calls.map(c => c[0].data.thing1.value);
        (0, vitest_1.expect)(things).toContain('订单待支付，请尽快完成');
        (0, vitest_1.expect)(things).toContain('订单超时未支付，已自动取消');
        (0, vitest_1.expect)(things).toContain('退款已到账');
    });
    (0, vitest_1.it)('配置 h5BaseUrl → url 指向 H5 订单详情（跳转落地页）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 1, 'orderPlaced', undefined, 'https://www.yourbao.cn');
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendTemplate).toHaveBeenCalled());
        (0, vitest_1.expect)(sendTemplate.mock.calls[0][0].url).toBe('https://www.yourbao.cn/#/pkg-order/pages/order-detail?code=ORD1');
    });
});
//# sourceMappingURL=campus-notify.service.spec.js.map