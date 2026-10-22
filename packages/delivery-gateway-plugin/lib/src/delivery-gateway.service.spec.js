"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// vitest 不产出 decorator metadata，TypeORM 实体无法在此环境实例化；本用例只测服务逻辑，替换实体为占位类
vitest_1.vi.mock('./delivery-order.entity', () => ({ DeliveryOrder: class DeliveryOrder {
    } }));
const delivery_gateway_service_1 = require("./delivery-gateway.service");
function makeService(row) {
    const repo = {
        findOne: vitest_1.vi.fn(async () => row),
        save: vitest_1.vi.fn(async (x) => x),
        create: vitest_1.vi.fn((x) => x),
        find: vitest_1.vi.fn(async () => [row]),
    };
    const svc = new delivery_gateway_service_1.DeliveryGatewayService();
    svc.connection = { getRepository: () => repo };
    svc.orderPackageLinker = null;
    svc.injector = { get: () => null };
    return { svc, repo };
}
(0, vitest_1.describe)('DeliveryGatewayService', () => {
    (0, vitest_1.it)('applyStatusEvent 保存后回调 DeliveryStatusSink', async () => {
        const { svc, repo } = makeService({
            id: 9, code: 'D1', orderId: 100, packageId: 'p1', providerCode: 'dada',
            thirdPartyNo: 'T1', status: 'pending', courierName: null, courierPhone: null,
        });
        const sink = { onDeliveryStatus: vitest_1.vi.fn(async () => undefined) };
        svc.statusSink = sink;
        await svc.applyStatusEvent({}, { deliveryOrderNo: 'D1', status: 'accepted', courierName: '张师傅', courierPhone: '13800000000' });
        (0, vitest_1.expect)(repo.save).toHaveBeenCalled();
        (0, vitest_1.expect)(sink.onDeliveryStatus).toHaveBeenCalledWith({}, vitest_1.expect.objectContaining({
            deliveryOrderId: 9, orderId: 100, status: 'accepted', courierName: '张师傅',
        }));
    });
    (0, vitest_1.it)('cancelDelivery 用 thirdPartyNo 调 Provider 并落 cancelled', async () => {
        const { svc, repo } = makeService({
            id: 9, code: 'D1', orderId: 100, packageId: 'p1', providerCode: 'dada',
            thirdPartyNo: 'T1', status: 'accepted',
        });
        const cancel = vitest_1.vi.fn(async () => ({ success: true }));
        svc.providers.set('dada', { cancelDelivery: cancel });
        const res = await svc.cancelDelivery({}, 9, '商家关单');
        (0, vitest_1.expect)(cancel).toHaveBeenCalledWith({}, 'T1', '商家关单');
        (0, vitest_1.expect)(res.success).toBe(true);
        (0, vitest_1.expect)(repo.save).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'cancelled', reason: '商家关单' }));
    });
});
//# sourceMappingURL=delivery-gateway.service.spec.js.map