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

describe('SmsService 限流', () => {
    it('首次发码放行；60s 冷却内拒绝', () => {
        const svc = makeService();
        expect(svc.checkRateLimit('13800138000')).toBeNull();
        svc.sendVerificationCode('13800138000');
        expect(svc.checkRateLimit('13800138000')).toBe('cooldown');
        expect(svc.checkRateLimit('13900139000')).toBeNull();
    });

    it('同号每日发码达到上限后拒绝', () => {
        const svc = makeService();
        const phone = '13800138000';
        // 用假时间推进绕过冷却：直接注入 10 次当日计数
        for (let i = 0; i < 10; i++) {
            svc.checkRateLimit(phone);
            svc.sendVerificationCode(phone);
            // 手动回拨冷却时间，模拟跨过 60s
            (svc as any).sendCooldowns.set(phone, Date.now() - 61_000);
        }
        expect(svc.checkRateLimit(phone)).toBe('daily-limit');
    });
});

describe('SmsService 验证码校验', () => {
    it('正确验证码通过且一次性消费', async () => {
        const svc = makeService();
        await svc.sendVerificationCode('13800138000');
        const code = (svc as any).codeStore.get('13800138000').code;
        expect(svc.verifyCode('13800138000', code)).toBe(true);
        expect(svc.verifyCode('13800138000', code)).toBe(false); // 已消费
    });

    it(`连续失败 ${5} 次后验证码作废，正确码也不再通过`, async () => {
        const svc = makeService();
        await svc.sendVerificationCode('13800138000');
        const code = (svc as any).codeStore.get('13800138000').code;
        for (let i = 0; i < 5; i++) {
            expect(svc.verifyCode('13800138000', '000000')).toBe(false);
        }
        expect(svc.verifyCode('13800138000', code)).toBe(false); // 已作废
    });

    it('过期验证码不通过', async () => {
        const svc = makeService({ codeExpirySeconds: -1 });
        await svc.sendVerificationCode('13800138000');
        const code = (svc as any).codeStore.get('13800138000').code;
        expect(svc.verifyCode('13800138000', code)).toBe(false);
    });
});

describe('SmsService devBypass', () => {
    it('非生产环境 devBypass 生效', async () => {
        const svc = makeService({ devBypass: true });
        await svc.sendVerificationCode('13800138000');
        expect(svc.verifyCode('13800138000', '123456')).toBe(true);
    });

    it('生产环境强制忽略 devBypass', async () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            const svc = makeService({ devBypass: true });
            expect(svc.isDevBypass()).toBe(false);
            await svc.sendVerificationCode('13800138000');
            expect(svc.verifyCode('13800138000', '123456')).toBe(false);
        } finally {
            process.env.NODE_ENV = prev;
        }
    });
});
