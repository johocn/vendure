import { describe, expect, it } from 'vitest';

import { SmsService } from '../src/sms.service';
import type { PhoneAuthPluginOptions } from '../src/types';

const baseOptions: PhoneAuthPluginOptions = {
    accessKeyId: 'test-ak',
    accessKeySecret: 'test-sk',
    signName: '测试签名',
    templateCode: 'SMS_000',
};

function makeService(overrides: Partial<PhoneAuthPluginOptions> = {}): SmsService {
    return new SmsService({ ...baseOptions, ...overrides });
}

describe('SmsService 限流（进程内存存储）', () => {
    it('首次发码放行；60s 冷却内拒绝', async () => {
        const svc = makeService();
        expect(await svc.checkRateLimit('13800138000')).toBeNull();
        await svc.sendVerificationCode('13800138000');
        expect(await svc.checkRateLimit('13800138000')).toBe('cooldown');
        expect(await svc.checkRateLimit('13900139000')).toBeNull();
    });

    it('同号每日发码达到上限后拒绝', async () => {
        const svc = makeService();
        const phone = '13800138000';
        // 绕过 60s 冷却：发满 10 次后回拨冷却时间再触发当日上限
        for (let i = 0; i < 10; i++) {
            await svc.checkRateLimit(phone);
            await svc.sendVerificationCode(phone);
            (svc as any).store.cooldowns.set(phone, Date.now() - 61_000);
        }
        expect(await svc.checkRateLimit(phone)).toBe('daily-limit');
    });

    it('冷却期内重复调用不消耗每日额度', async () => {
        const svc = makeService();
        const phone = '13800138000';
        await svc.checkRateLimit(phone);
        await svc.sendVerificationCode(phone);
        for (let i = 0; i < 5; i++) {
            expect(await svc.checkRateLimit(phone)).toBe('cooldown');
        }
        // 手动回拨冷却后，仅累计到第 2 次（初始占额 1 + 本次 1）
        (svc as any).store.cooldowns.set(phone, Date.now() - 61_000);
        expect(await svc.checkRateLimit(phone)).toBeNull();
    });
});

describe('SmsService 验证码校验', () => {
    it('正确验证码通过且一次性消费', async () => {
        const svc = makeService();
        await svc.sendVerificationCode('13800138000');
        const code = (await (svc as any).store.getCode('13800138000')).code;
        expect(await svc.verifyCode('13800138000', code)).toBe(true);
        expect(await svc.verifyCode('13800138000', code)).toBe(false); // 已消费
    });

    it('连续失败 5 次后验证码作废，正确码也不再通过', async () => {
        const svc = makeService();
        await svc.sendVerificationCode('13800138000');
        const code = (await (svc as any).store.getCode('13800138000')).code;
        for (let i = 0; i < 5; i++) {
            expect(await svc.verifyCode('13800138000', '000000')).toBe(false);
        }
        expect(await svc.verifyCode('13800138000', code)).toBe(false); // 已作废
    });

    it('过期验证码不通过', async () => {
        const svc = makeService({ codeExpirySeconds: -1 });
        await svc.sendVerificationCode('13800138000');
        const code = (await (svc as any).store.getCode('13800138000')).code;
        expect(await svc.verifyCode('13800138000', code)).toBe(false);
    });
});

describe('SmsService devBypass', () => {
    it('非生产环境 devBypass 生效', async () => {
        const svc = makeService({ devBypass: true });
        await svc.sendVerificationCode('13800138000');
        expect(await svc.verifyCode('13800138000', '123456')).toBe(true);
    });

    it('生产环境强制忽略 devBypass', async () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            const svc = makeService({ devBypass: true });
            expect(svc.isDevBypass()).toBe(false);
            await svc.sendVerificationCode('13800138000');
            expect(await svc.verifyCode('13800138000', '123456')).toBe(false);
        } finally {
            process.env.NODE_ENV = prev;
        }
    });
});
