import { describe, expect, it } from 'vitest';
import { cityServes, pinByCity } from './stock-city-filter';
import type { ID } from '@vendure/core';

const L1 = 'loc-1' as ID;
const L2 = 'loc-2' as ID;
const levels = [
  { stockLocationId: L1, stockOnHand: 30 },
  { stockLocationId: L2, stockOnHand: 20 },
];
const bindings = [{ locationId: L1 }, { locationId: L2 }];

describe('cityServes', () => {
  it('未配置 serviceCities 视为全城可服务', () => {
    expect(cityServes(undefined, '武汉')).toBe(true);
    expect(cityServes([], '武汉')).toBe(true);
  });
  it('精确命中与包含匹配', () => {
    expect(cityServes(['武汉'], '武汉')).toBe(true);
    expect(cityServes(['武汉'], '武汉市')).toBe(true);
    expect(cityServes(['武汉'], '上海')).toBe(false);
  });
  it('忽略大小写/空格并跳过非字符串项', () => {
    expect(cityServes(['  WuHan '], 'wuhan')).toBe(true);
    expect(cityServes([123 as any, '上海'], '北京')).toBe(false);
  });
});

describe('pinByCity', () => {
  const cities = new Map<string, unknown>();
  cities.set('loc-1', ['武汉']);
  cities.set('loc-2', ['上海']);

  it('city 为空时返回全部绑定仓合计（保持 D4）', () => {
    const r = pinByCity(levels, bindings, cities, null);
    expect(r.servedOnHand).toBe(50);
    expect(r.servedLocations).toHaveLength(2);
  });
  it('按城市仅聚合可服务仓', () => {
    const r = pinByCity(levels, bindings, cities, '武汉');
    expect(r.servedOnHand).toBe(30);
    expect(r.servedLocations).toEqual(['loc-1']);
  });
  it('城市无任何可服务仓返回空集与 onHand=0（由调用方回退虚拟仓）', () => {
    const r = pinByCity(levels, bindings, cities, '北京');
    expect(r.servedOnHand).toBe(0);
    expect(r.servedLocations).toHaveLength(0);
  });
});
