/**
 * CustomerBindingService 单测（假件注入）：
 * openid 幂等 / 防冒领（phone_taken）/ 同手机号补绑定 / 全新建档 / 地址失败不阻塞。
 */
import { describe, expect, test } from 'vitest';
import { Customer, User } from '@vendure/core';

import { CustomerBindingService } from './customer-binding.service';

function makeDeps(opts: {
    byOpenid?: any;
    byPhone?: any;
    createUserError?: boolean;
    addressError?: boolean;
} = {}) {
    const calls = {
        updates: [] as any[],
        addresses: [] as any[],
        channelAssigns: [] as any[],
        savedCustomers: [] as any[],
    };
    // 无 ctx 版（openid 查询）/ 有 ctx 版（手机号查询 + 建档）
    const customerRepoNoCtx = {
        findOne: async () => opts.byOpenid ?? null,
    };
    const customerRepo = {
        createQueryBuilder: () => ({
            where: () => ({ andWhere: () => ({ getOne: async () => opts.byPhone ?? null }) }),
        }),
        save: async (c: any) => {
            const saved = { id: 99, customFields: {}, ...c };
            calls.savedCustomers.push(saved);
            return saved;
        },
    };
    const userRepo = { findOne: async () => ({ id: 7, identifier: 'wechat_mp_oX' }) };
    const connection = {
        getRepository: (...args: any[]) => {
            // getRepository(entity) 单参 = 无 ctx（openid 查询）；getRepository(ctx, entity) 双参
            if (args.length === 1) return customerRepoNoCtx;
            if (args[1] === Customer) return customerRepo;
            if (args[1] === User) return userRepo;
            throw new Error(`unexpected repo: ${String(args[1])}`);
        },
    };
    const userService = {
        createCustomerUser: async (_ctx: any, identifier: string) => {
            if (opts.createUserError) return { message: 'duplicate', errorCode: 'IDENTIFIER_ALREADY_EXISTS' } as any;
            return { id: 7, identifier, verified: false } as any;
        },
    };
    const customerService = {
        update: async (_ctx: any, input: any) => {
            calls.updates.push(input);
            return { id: input.id } as any;
        },
        createAddress: async (_ctx: any, customerId: any, input: any) => {
            if (opts.addressError) throw new Error('country not found');
            calls.addresses.push({ customerId, input });
            return { id: 55 } as any;
        },
    };
    const channelService = {
        assignToChannels: async (_ctx: any, _e: any, id: any, channels: any[]) => {
            calls.channelAssigns.push({ id, channels });
        },
    };
    const svc = new CustomerBindingService(
        connection as any,
        userService as any,
        customerService as any,
        channelService as any,
    );
    const ctx = { channelId: '2' } as any;
    return { svc, ctx, calls };
}

describe('CustomerBindingService', () => {
    test('openid 已绑定 → 幂等返回既有顾客，不再建号', async () => {
        const existing = { id: 42 };
        const { svc, ctx, calls } = makeDeps({ byOpenid: existing });
        const out = await svc.bindOrCreateCustomer(ctx, 'oX', '13800138000');
        expect(out.status).toBe('ok');
        expect(out.status === 'ok' && out.customer).toBe(existing);
        expect(calls.savedCustomers.length).toBe(0);
    });

    test('手机号已注册且已绑其他微信 → phone_taken（防冒领）', async () => {
        const { svc, ctx, calls } = makeDeps({ byPhone: { id: 88, customFields: { wechatOpenid: 'oOTHER' } } });
        const out = await svc.bindOrCreateCustomer(ctx, 'oX', '13800138000');
        expect(out.status).toBe('phone_taken');
        expect(calls.savedCustomers.length).toBe(0);
    });

    test('手机号已注册但未绑微信 → 补绑定（写 openid）', async () => {
        const byPhone = { id: 88, customFields: {} };
        const { svc, ctx, calls } = makeDeps({ byPhone });
        const out = await svc.bindOrCreateCustomer(ctx, 'oX', '13800138000');
        expect(out.status).toBe('ok');
        expect(out.status === 'ok' && out.customer.id).toBe(88);
        expect(calls.updates[0].customFields.wechatOpenid).toBe('oX');
        expect(calls.channelAssigns[0].channels).toEqual(['2']);
    });

    test('手机号已注册未绑微信 + 输入地址 → 补绑定同时保存默认地址', async () => {
        const byPhone = { id: 88, customFields: {} };
        const { svc, ctx, calls } = makeDeps({ byPhone });
        const out = await svc.bindOrCreateCustomer(ctx, 'oX', '13800138000', '吉林市丰满区江南街1号');
        expect(out.status).toBe('ok');
        expect(calls.addresses.length).toBe(1);
        expect(calls.addresses[0].customerId).toBe(88);
        expect(calls.addresses[0].input.streetLine1).toBe('吉林市丰满区江南街1号');
        expect(calls.addresses[0].input.defaultShippingAddress).toBe(true);
    });

    test('全新建档 → User+Customer+openid+地址，identifier 对齐 wechat_mp 规则', async () => {
        const { svc, ctx, calls } = makeDeps();
        const out = await svc.bindOrCreateCustomer(ctx, 'oX', '13800138000', '北京市朝阳区建国路1号');
        expect(out.status).toBe('ok');
        expect(calls.savedCustomers[0].phoneNumber).toBe('13800138000');
        expect(calls.updates[0].customFields.wechatOpenid).toBe('oX');
        expect(calls.addresses[0].input.streetLine1).toBe('北京市朝阳区建国路1号');
        expect(calls.addresses[0].input.phoneNumber).toBe('13800138000');
        // 建档首地址即默认收货地址（下单选址列表 ⭐ 置顶 + placeOrder 兜底）
        expect(calls.addresses[0].input.defaultShippingAddress).toBe(true);
    });

    test('地址创建失败（国家码缺失等）→ 不阻塞建档', async () => {
        const { svc, ctx, calls } = makeDeps({ addressError: true });
        const out = await svc.bindOrCreateCustomer(ctx, 'oX', '13800138000', '某地址');
        expect(out.status).toBe('ok');
        expect(calls.savedCustomers.length).toBe(1);
    });
});
