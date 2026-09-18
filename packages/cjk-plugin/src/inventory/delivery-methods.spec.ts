import { describe, it, expect } from 'vitest';
import {
  locationSupports,
  filterLocationsByDelivery,
  type DeliveryMethod,
  type LocationLike,
} from './delivery-methods';

const loc = (methods: string[] | null): LocationLike => ({ customFields: { deliveryMethods: methods } });
const methods = (m: DeliveryMethod[]) => m;

describe('locationSupports 三态矩阵', () => {
  it('仅 MAIL：支持邮寄、不支持自提', () => {
    expect(locationSupports(loc(['MAIL']), 'MAIL')).toBe(true);
    expect(locationSupports(loc(['MAIL']), 'SELF_PICKUP')).toBe(false);
  });
  it('仅 SELF_PICKUP：支持自提、不支持邮寄', () => {
    expect(locationSupports(loc(['SELF_PICKUP']), 'SELF_PICKUP')).toBe(true);
    expect(locationSupports(loc(['SELF_PICKUP']), 'MAIL')).toBe(false);
  });
  it('双模式：都支持', () => {
    expect(locationSupports(loc(['MAIL', 'SELF_PICKUP']), 'MAIL')).toBe(true);
    expect(locationSupports(loc(['MAIL', 'SELF_PICKUP']), 'SELF_PICKUP')).toBe(true);
  });
  it('空数组 / undefined：兼容旧数据，都支持', () => {
    expect(locationSupports(loc([]), 'MAIL')).toBe(true);
    expect(locationSupports(loc([]), 'SELF_PICKUP')).toBe(true);
    expect(locationSupports(loc(null), 'MAIL')).toBe(true);
  });
});

describe('filterLocationsByDelivery', () => {
  const mail = loc(['MAIL']);
  const pickup = loc(['SELF_PICKUP']);
  const both = loc(['MAIL', 'SELF_PICKUP']);
  const legacy = loc(null);

  it('请求 MAIL：仅保留含 MAIL 的网点', () => {
    expect(filterLocationsByDelivery([mail, pickup, both, legacy], methods(['MAIL']))).toEqual([mail, both, legacy]);
  });
  it('请求 SELF_PICKUP：仅保留含 SELF_PICKUP 的网点', () => {
    expect(filterLocationsByDelivery([mail, pickup, both, legacy], methods(['SELF_PICKUP']))).toEqual([pickup, both, legacy]);
  });
  it('请求两者：全部保留', () => {
    expect(filterLocationsByDelivery([mail, pickup, both, legacy], methods(['MAIL', 'SELF_PICKUP']))).toEqual([mail, pickup, both, legacy]);
  });
  it('请求为空：全部保留（不做过滤）', () => {
    expect(filterLocationsByDelivery([mail, pickup], [])).toEqual([mail, pickup]);
  });
});
