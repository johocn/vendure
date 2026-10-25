import { describe, expect, test } from 'vitest';
import { codesFromAdcode, extractPhone, buildParsedAddress } from './address-parser';

describe('codesFromAdcode', () => {
    test('6 位区县码推导省/市/区县码', () => {
        expect(codesFromAdcode('220211')).toEqual({
            provinceCode: '220000',
            cityCode: '220200',
            districtCode: '220211',
        });
    });
    test('非 6 位返回全 null', () => {
        expect(codesFromAdcode('2202')).toEqual({ provinceCode: null, cityCode: null, districtCode: null });
        expect(codesFromAdcode(null)).toEqual({ provinceCode: null, cityCode: null, districtCode: null });
    });
});

describe('extractPhone', () => {
    test('从文本识别 11 位手机号并从文本剥离', () => {
        expect(extractPhone('吉林市丰满区江南街1号 张三 13800138000')).toEqual({
            phoneNumber: '13800138000',
            rest: '吉林市丰满区江南街1号 张三',
        });
    });
    test('无手机号', () => {
        expect(extractPhone('吉林市丰满区江南街1号')).toEqual({ phoneNumber: null, rest: '吉林市丰满区江南街1号' });
    });
});

describe('buildParsedAddress', () => {
    const geo = {
        province: '吉林省',
        city: '吉林市',
        district: '丰满区',
        adcode: '220211',
        lat: 43.8,
        lng: 126.5,
        formattedAddress: '吉林省吉林市丰满区江南街1号',
    };

    test('完整地址无 missing', () => {
        const r = buildParsedAddress(geo, '江南街1号 13800138000');
        expect(r.cityCode).toBe('220200');
        expect(r.districtCode).toBe('220211');
        expect(r.phoneNumber).toBe('13800138000');
        expect(r.missing).toEqual([]);
    });

    test('缺坐标 → missing 含 district（无法判定区县）', () => {
        const r = buildParsedAddress({ ...geo, adcode: null }, '江南街1号 13800138000');
        expect(r.missing).toContain('district');
    });

    test('缺电话 → missing 含 phone', () => {
        const r = buildParsedAddress(geo, '江南街1号');
        expect(r.missing).toContain('phone');
    });
});
