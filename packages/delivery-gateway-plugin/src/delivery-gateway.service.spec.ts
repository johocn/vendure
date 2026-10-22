import { describe, expect, it, vi } from 'vitest';

// vitest 不产出 decorator metadata，TypeORM 实体无法在此环境实例化；本用例只测服务逻辑，替换实体为占位类
vi.mock('./delivery-order.entity', () => ({ DeliveryOrder: class DeliveryOrder {} }));

import { DeliveryGatewayService } from './delivery-gateway.service';

function makeService(row: any) {
    const repo = {
        findOne: vi.fn(async () => row),
        save: vi.fn(async (x: any) => x),
        create: vi.fn((x: any) => x),
        find: vi.fn(async () => [row]),
    };
    const svc = new DeliveryGatewayService();
    (svc as any).connection = { getRepository: () => repo };
    (svc as any).orderPackageLinker = null;
    (svc as any).injector = { get: () => null };
    return { svc, repo };
}

describe('DeliveryGatewayService', () => {
    it('applyStatusEvent 保存后回调 DeliveryStatusSink', async () => {
        const { svc, repo } = makeService({
            id: 9, code: 'D1', orderId: 100, packageId: 'p1', providerCode: 'dada',
            thirdPartyNo: 'T1', status: 'pending', courierName: null, courierPhone: null,
        });
        const sink = { onDeliveryStatus: vi.fn(async () => undefined) };
        (svc as any).statusSink = sink;

        await svc.applyStatusEvent({} as any, { deliveryOrderNo: 'D1', status: 'accepted', courierName: '张师傅', courierPhone: '13800000000' });

        expect(repo.save).toHaveBeenCalled();
        expect(sink.onDeliveryStatus).toHaveBeenCalledWith({} as any, expect.objectContaining({
            deliveryOrderId: 9, orderId: 100, status: 'accepted', courierName: '张师傅',
        }));
    });

    it('cancelDelivery 用 thirdPartyNo 调 Provider 并落 cancelled', async () => {
        const { svc, repo } = makeService({
            id: 9, code: 'D1', orderId: 100, packageId: 'p1', providerCode: 'dada',
            thirdPartyNo: 'T1', status: 'accepted',
        });
        const cancel = vi.fn(async () => ({ success: true }));
        (svc as any).providers.set('dada', { cancelDelivery: cancel });

        const res = await svc.cancelDelivery({} as any, 9, '商家关单');

        expect(cancel).toHaveBeenCalledWith({} as any, 'T1', '商家关单');
        expect(res.success).toBe(true);
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled', reason: '商家关单' }));
    });
});
