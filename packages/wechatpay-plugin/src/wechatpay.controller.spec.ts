import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 叶子模块 mock：本题只验证 dev 端点门禁，不需真实渠道解析 / 渠道支付配置
vi.mock('@vendure/cjk-plugin/lib/src/tenant/domain-resolver.service', () => ({
    findChannelByDomain: vi.fn().mockResolvedValue({ id: 1, code: 'default' }),
}));
vi.mock('@vendure/cjk-plugin/lib/src/payment/payment-config', () => ({
    getPaymentOverride: vi.fn().mockReturnValue(null),
}));

import { WechatpayController } from './wechatpay.controller';

function makeRes() {
    const res: any = {
        status: vi.fn(),
        json: vi.fn(),
        send: vi.fn(),
        setHeader: vi.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
}

function makeController(devBypass: boolean) {
    const settlement = { find: vi.fn().mockReturnValue(undefined), settle: vi.fn() };
    const orderService = { findOneByCode: vi.fn().mockResolvedValue(null) };
    const ctrl = new WechatpayController(
        { devBypass } as any,
        orderService as any,
        { getDefaultChannel: vi.fn() } as any,
        {} as any,
        {} as any,
        settlement as any,
    );
    return { ctrl, settlement, orderService };
}

const req = { query: { outTradeNo: 'ORD1' }, headers: {}, hostname: 'localhost' } as any;

describe('WechatpayController dev 端点门禁（P0 修复：仅 devBypass 可用）', () => {
    beforeEach(() => vi.clearAllMocks());

    it('devBypass 关闭：dev-notify 返回 404，且不触发任何结算', async () => {
        const { ctrl, settlement, orderService } = makeController(false);
        const res = makeRes();
        await ctrl.devNotify(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(settlement.find).not.toHaveBeenCalled();
        expect(settlement.settle).not.toHaveBeenCalled();
        expect(orderService.findOneByCode).not.toHaveBeenCalled();
    });

    it('devBypass 关闭：dev-pay 返回 404 页面', () => {
        const { ctrl } = makeController(false);
        const res = makeRes();
        ctrl.getDevPayPage(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledWith('Not Found');
    });

    it('devBypass 开启：dev-notify 正常路由结算并返回 200', async () => {
        const { ctrl, settlement } = makeController(true);
        const res = makeRes();
        await ctrl.devNotify(req, res);
        expect(settlement.find).toHaveBeenCalledWith('ORD1');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('devBypass 开启：dev-pay 渲染模拟支付页', () => {
        const { ctrl } = makeController(true);
        const res = makeRes();
        ctrl.getDevPayPage(req, res);
        expect(res.status).not.toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledTimes(1);
        expect(String(res.send.mock.calls[0][0])).toContain('ORD1');
    });
});
