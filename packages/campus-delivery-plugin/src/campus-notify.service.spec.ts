import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WechatAuthService } from '@vendure/wechat-auth-plugin';
import { CampusNotifyService } from './campus-notify.service';

/** 用户侧节点通知：fire-and-forget 语义（未配置/无 openid/发送失败均不上抛） */
describe('CampusNotifyService', () => {
    const makeCtx = () => ({ channelId: 7 } as any);

    function makeSvc(opts: { templateId?: string | null; openid?: string | null; sendErr?: Error }) {
        const findOne = vi.fn().mockResolvedValue(
            opts.openid === null
                ? { code: 'ORD1', customer: { customFields: { wechatMiniOpenid: 'mini-x' } } }
                : { code: 'ORD1', customer: { customFields: { wechatOpenid: 'o-123' } } },
        );
        const sendTemplate = vi.fn().mockImplementation(async () => {
            if (opts.sendErr) throw opts.sendErr;
            return { errcode: 0, msgid: 1001 };
        });
        const svc = new CampusNotifyService(
            { getRepository: () => ({ findOne }) } as any,
            {
                getConfig: vi.fn().mockResolvedValue({
                    notifyTemplateAccepted: opts.templateId ?? null,
                    notifyTemplateRiderAssigned: opts.templateId ?? null,
                    notifyTemplateCookingDone: opts.templateId ?? null,
                    notifyTemplateDelivered: opts.templateId ?? null,
                    notifyTemplateExceptionHandled: opts.templateId ?? null,
                    notifyTemplateOrderPlaced: opts.templateId ?? null,
                    notifyTemplatePaymentPending: opts.templateId ?? null,
                    notifyTemplateCancelled: opts.templateId ?? null,
                    notifyTemplateAfterSales: opts.templateId ?? null,
                }),
            } as any,
            { get: vi.fn().mockReturnValue({ sendTemplate }) } as any,
        );
        return { svc, findOne, sendTemplate };
    }

    beforeEach(() => vi.clearAllMocks());

    it('未配置模板 → 跳过（不查订单不发送）', async () => {
        const { svc, findOne, sendTemplate } = makeSvc({ templateId: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vi.waitFor(() => expect(findOne).not.toHaveBeenCalled());
        expect(sendTemplate).not.toHaveBeenCalled();
    });

    it('用户无公众号 openid（仅小程序 openid）→ 跳过发送', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: null });
        svc.user(makeCtx(), 1, 'orderAccepted');
        await vi.waitFor(() => expect(sendTemplate).not.toHaveBeenCalled());
    });

    it('配置 + openid → sendTemplate 收到映射数据（订单号/状态/时间）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 1, 'cookingDone');
        await vi.waitFor(() => expect(sendTemplate).toHaveBeenCalled());
        const arg = sendTemplate.mock.calls[0][0];
        expect(arg.touser).toBe('o-123');
        expect(arg.template_id).toBe('TID');
        expect(arg.data.character_string1.value).toBe('ORD1');
        expect(arg.data.thing1.value).toBe('出餐完成，等待取货');
        expect(arg.data.time2.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('发送抛错 → 静默吞掉（不 unhandledRejection）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123', sendErr: new Error('wx down') });
        svc.user(makeCtx(), 1, 'orderDelivered');
        await vi.waitFor(() => expect(sendTemplate).toHaveBeenCalled());
        // fire-and-forget promise 已内部消化
        await new Promise(r => setTimeout(r, 10));
    });

    it('exceptionHandled：动态文案覆盖 thing1（处置结果 push，plan 3.4 补全）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 2, 'exceptionHandled', '订单已全额退款');
        await vi.waitFor(() => expect(sendTemplate).toHaveBeenCalled());
        const arg = sendTemplate.mock.calls[0][0];
        expect(arg.data.thing1.value).toBe('订单已全额退款');
    });

    it('orderPlaced：映射 thing1=订单支付成功，商家接单中', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 1, 'orderPlaced');
        await vi.waitFor(() => expect(sendTemplate).toHaveBeenCalled());
        expect(sendTemplate.mock.calls[0][0].data.thing1.value).toBe('订单支付成功，商家接单中');
    });

    it('paymentPending / orderCancelled / afterSales 文案映射', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        svc.user(makeCtx(), 1, 'paymentPending');
        svc.user(makeCtx(), 1, 'orderCancelled', '订单超时未支付，已自动取消');
        svc.user(makeCtx(), 1, 'afterSales', '退款已到账');
        await vi.waitFor(() => expect(sendTemplate).toHaveBeenCalledTimes(3));
        const things = sendTemplate.mock.calls.map(c => c[0].data.thing1.value);
        expect(things).toContain('订单待支付，请尽快完成');
        expect(things).toContain('订单超时未支付，已自动取消');
        expect(things).toContain('退款已到账');
    });

    it('配置 h5BaseUrl → url 指向 H5 订单详情（跳转落地页）', async () => {
        const { svc, sendTemplate } = makeSvc({ templateId: 'TID', openid: 'o-123' });
        (svc as any).user(makeCtx(), 1, 'orderPlaced', undefined, 'https://www.yourbao.cn');
        await vi.waitFor(() => expect(sendTemplate).toHaveBeenCalled());
        expect(sendTemplate.mock.calls[0][0].url).toBe('https://www.yourbao.cn/#/pkg-order/pages/order-detail?code=ORD1');
    });
});
