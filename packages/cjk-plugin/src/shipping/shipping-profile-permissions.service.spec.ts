import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Permission } from '@vendure/core';
import { assertProfileGlobalPermissions } from './shipping-profile.service';

// vitest 用 esbuild 转换源码，esbuild 不支持 emitDecoratorMetadata，
// 而本地 typeorm 实体（如 @Column() name: string）依赖 design:type 元数据才能推断列类型。
// 故对 service 的本地依赖模块做 mock，避免加载真实实体触发 ColumnTypeUndefinedError；
// 本测试只验证纯函数 assertProfileGlobalPermissions，不依赖这些模块的具体实现。
vi.mock('./shipping-profile.entity', () => ({ ShippingProfile: class ShippingProfile {} }));
vi.mock('./shipping-profile-method.entity', () => ({ ShippingProfileMethod: class ShippingProfileMethod {} }));
vi.mock('../pickup/pickup-location.entity', () => ({ PickupLocation: class PickupLocation {} }));
vi.mock('../pickup/pickup-location.service', () => ({ PickupLocationService: class PickupLocationService {} }));
vi.mock('../payment/payment-profile.entity', () => ({ PaymentProfile: class PaymentProfile {} }));
vi.mock('../payment/payment-profile.service', () => ({ PaymentProfileService: class PaymentProfileService {} }));

const uctx = (opts: { isSuper?: boolean } = {}) =>
  ({ userHasPermissions: (p: Permission[]) => (opts.isSuper ? true : (p as string[]).includes('?none?')) }) as any;
const prof = (p: Partial<{ isGlobal: boolean; ownerChannelId: number | null }>) => p as any;
const input = (p: Partial<{ isGlobal?: boolean }>) => p as any;

describe('assertProfileGlobalPermissions', () => {
  it('非超管 create isGlobal=true -> throw', () => {
    let ok = false;
    try { assertProfileGlobalPermissions(uctx(), 'create', prof({ isGlobal: false }), input({ isGlobal: true }), prof({ isGlobal: false })); }
    catch (e: any) { ok = /仅超级管理员可创建全局档案/.test(e.message); }
    expect(ok).toBe(true);
  });

  it('超管 create isGlobal=true -> 不抛', () => {
    expect(() =>
      assertProfileGlobalPermissions(uctx({ isSuper: true }), 'create', prof({ isGlobal: false }), input({ isGlobal: true }), prof({ isGlobal: false })),
    ).not.toThrow();
  });

  it('非超管 update 改 isGlobal -> throw', () => {
    let msg = '';
    try { assertProfileGlobalPermissions(uctx(), 'update', prof({ isGlobal: false }), input({ isGlobal: true }), prof({ isGlobal: false })); }
    catch (e: any) { msg = e.message; }
    expect(msg).toMatch(/仅超级管理员可修改全局属性/);
  });

  it('超管 update 由真改伪（全局→租户）-> 通过', () => {
    expect(() =>
      assertProfileGlobalPermissions(uctx({ isSuper: true }), 'update', prof({ isGlobal: true }), input({ isGlobal: false }), prof({ isGlobal: true })),
    ).not.toThrow();
  });

  it('超管 update 由伪改真（租户→全局）-> 通过', () => {
    expect(() =>
      assertProfileGlobalPermissions(uctx({ isSuper: true }), 'update', prof({ isGlobal: false }), input({ isGlobal: true }), prof({ isGlobal: false })),
    ).not.toThrow();
  });

  it('非超管 delete 全局档案 -> throw', () => {
    let msg = '';
    try { assertProfileGlobalPermissions(uctx(), 'delete', undefined as any, undefined as any, prof({ isGlobal: true })); }
    catch (e: any) { msg = e.message; }
    expect(msg).toMatch(/仅超级管理员可删除全局档案/);
  });

  it('超管 delete 全局档案 -> 通过', () => {
    expect(() =>
      assertProfileGlobalPermissions(uctx({ isSuper: true }), 'delete', undefined as any, undefined as any, prof({ isGlobal: true })),
    ).not.toThrow();
  });
});
