"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const campus_notify_service_1 = require("./campus-notify.service");
/** 用户侧节点通知：fire-and-forget 语义（未配置/无 openid/发送失败均不上抛） */
(0, vitest_1.describe)('CampusNotifyService', () => {
    const makeCtx = () => ({ channelId: 7 });
    function makeSvc(opts) {
        var _a, _b, _c, _d;
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
});
//# sourceMappingURL=campus-notify.service.spec.js.map