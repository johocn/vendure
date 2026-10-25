import { describe, expect, test } from 'vitest';
import { DeliveryGuardService } from './delivery-guard.service';

const geo = {
    province: '吉林省', city: '吉林市', district: '丰满区', adcode: '220211',
    lat: 43.8, lng: 126.5, formattedAddress: '吉林省吉林市丰满区江南街1号',
};

/** connection 假件：rawConnection.getRepository(...).findOne 返回指定渠道 */
function makeGuard(channel: any, geocode: any = geo) {
    const connection = { rawConnection: { getRepository: () => ({ findOne: async () => channel }) } };
    const geoService = { geocode: async () => geocode };
    return new DeliveryGuardService(connection as any, geoService as any);
}

const channel = (servingCities: string[]) => ({ id: 111, customFields: { servingCities } });

describe('DeliveryGuardService.check', () => {
    test('城市命中服务范围 → OK', async () => {
        const guard = makeGuard(channel(['220200']));
        const r = await guard.check({} as any, '111', '江南街1号 13800138000');
        expect(r.status).toBe('OK');
        expect(r.parsed?.cityCode).toBe('220200');
    });

    test('城市不在服务范围 → OUT_OF_RANGE + 城市文案', async () => {
        const guard = makeGuard(channel(['220100']));
        const r = await guard.check({} as any, '111', '江南街1号 13800138000');
        expect(r.status).toBe('OUT_OF_RANGE');
        expect(r.serviceAreaText).toContain('吉林市');
    });

    test('渠道未配置服务城市 → 不限制（OK）', async () => {
        const guard = makeGuard(channel([]));
        const r = await guard.check({} as any, '111', '江南街1号');
        expect(r.status).toBe('OK');
    });

    test('地理编码失败 → UNKNOWN（fail closed）', async () => {
        const guard = makeGuard(channel(['220200']), null);
        const r = await guard.check({} as any, '111', '乱写的地址');
        expect(r.status).toBe('UNKNOWN');
    });

    test('parse 只解析地址，不判定范围', async () => {
        const guard = makeGuard(channel(['220100']));
        const parsed = await guard.parse({} as any, '江南街1号 13800138000');
        expect(parsed?.cityCode).toBe('220200');
        expect(parsed?.phoneNumber).toBe('13800138000');
    });
});
