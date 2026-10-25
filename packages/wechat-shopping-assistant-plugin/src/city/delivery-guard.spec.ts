import { describe, expect, test } from 'vitest';
import { DeliveryGuardService } from './delivery-guard.service';
import { buildParsedAddress } from './address-parser';

const geo = {
    province: '吉林省', city: '吉林市', district: '丰满区', adcode: '220211',
    lat: 43.8, lng: 126.5, formattedAddress: '吉林省吉林市丰满区江南街1号',
};

/** connection 假件：rawConnection.getRepository(...).findOne 返回指定配送范围 */
function makeGuard(range: any, results: any[], geocode: any = geo) {
    const deliveryService = { validateDelivery: async () => results };
    const connection = { rawConnection: { getRepository: () => ({ findOne: async () => range }) } };
    const geoService = { geocode: async () => geocode };
    return new DeliveryGuardService(deliveryService as any, connection as any, geoService as any);
}

describe('DeliveryGuardService.check', () => {
    test('范围内 → OK', async () => {
        const guard = makeGuard({ channelId: 111, shopId: 111, rangeType: 'district', radiusKm: null, districtCodes: '["220211"]' }, [{ inRange: true, reason: 'OK' }]);
        const r = await guard.check({} as any, '111', '江南街1号 13800138000');
        expect(r.status).toBe('OK');
        expect(r.parsed?.cityCode).toBe('220200');
    });

    test('超范围 → OUT_OF_RANGE + 半径文案', async () => {
        const guard = makeGuard({ channelId: 111, shopId: 111, rangeType: 'circle', radiusKm: 3, districtCodes: null }, [{ inRange: false, reason: 'BEYOND_RANGE' }]);
        const r = await guard.check({} as any, '111', '江南街1号 13800138000');
        expect(r.status).toBe('OUT_OF_RANGE');
        expect(r.serviceAreaText).toContain('3 公里');

    });

    test('无配送配置 → OUT_OF_RANGE', async () => {
        const guard = makeGuard(null, []);
        const r = await guard.check({} as any, '111', '江南街1号');
        expect(r.status).toBe('OUT_OF_RANGE');
    });

    test('地理编码失败 → UNKNOWN（fail closed）', async () => {
        const guard = makeGuard({}, [], null);
        const r = await guard.check({} as any, '111', '乱写的地址');
        expect(r.status).toBe('UNKNOWN');
    });

    test('parse 只解析地址，不判定范围', async () => {
        const guard = makeGuard(null, []);
        const parsed = await guard.parse({} as any, '江南街1号 13800138000');
        expect(parsed?.cityCode).toBe('220200');
        expect(parsed?.phoneNumber).toBe('13800138000');
    });
});
