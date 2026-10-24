import { createCipheriv, createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import { buildWebhookPayload, buildWebhookSignature } from './feishu.client';
import { parseCommand, requiredRole } from './feishu.command.service';
import { parseChatMap, readFeishuSettings } from './feishu.config';
import { decryptFeishuPayload } from './feishu.crypto';
import { campusHhmm } from './feishu.digest.service';
import { formatBoard, formatDigest, formatPush } from './feishu.templates';

function encrypt(plain: string, encryptKey: string): string {
    const key = createHash('sha256').update(encryptKey).digest();
    const iv = Buffer.alloc(16, 7);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([iv, cipher.update(plain, 'utf8'), cipher.final()]).toString('base64');
}

describe('feishu crypto', () => {
    it('解密飞书 AES-256-CBC 事件体', () => {
        const body = { header: { event_type: 'im.message.receive_v1' }, challenge: 'abc' };
        const decoded = decryptFeishuPayload(encrypt(JSON.stringify(body), 'k-123'), 'k-123');
        expect(decoded).toEqual(body);
    });

    it('密文损坏/密钥为空时返回 null 而不是抛错', () => {
        expect(decryptFeishuPayload('not-base64!!', 'k')).toBeNull();
        expect(decryptFeishuPayload('', 'k')).toBeNull();
        expect(decryptFeishuPayload(encrypt('{}', 'k'), '')).toBeNull();
        expect(decryptFeishuPayload(encrypt('{}', 'k'), 'wrong-key')).toBeNull();
    });
});

describe('feishu command parsing', () => {
    it('识别中文指令与单号', () => {
        expect(parseCommand('待处理')).toEqual({ name: 'board' });
        expect(parseCommand('接单 A1234')).toEqual({ name: 'accept', orderCode: 'A1234' });
        expect(parseCommand('拒单 A1234 缺货')).toEqual({
            name: 'reject',
            orderCode: 'A1234',
            reason: '缺货',
        });
        expect(parseCommand('确认拒单 A1234')).toEqual({ name: 'confirmReject', orderCode: 'A1234' });
        expect(parseCommand('关店').name).toBe('close');
        expect(parseCommand('帮助').name).toBe('help');
        expect(parseCommand('随便说点什么').name).toBe('unknown');
    });

    it('去掉 @ 提及与多余空白后再解析', () => {
        expect(parseCommand('  @_user_1   接单   A1234  ')).toEqual({ name: 'accept', orderCode: 'A1234' });
    });

    it('权限分级：拒单/开关店需店主，接单/看板仅需操作员', () => {
        expect(requiredRole('accept')).toBe('operator');
        expect(requiredRole('board')).toBe('operator');
        expect(requiredRole('reject')).toBe('owner');
        expect(requiredRole('confirmReject')).toBe('owner');
        expect(requiredRole('close')).toBe('owner');
        expect(requiredRole('help')).toBe('none');
        expect(requiredRole('unknown')).toBe('none');
    });
});

describe('feishu settings', () => {
    it('FEISHU_CHAT_MAP 支持数组与逗号分隔两种白名单写法', () => {
        const chats = parseChatMap(
            JSON.stringify({
                oc_1: { channel: 'canteen-a', operators: 'ou_a,ou_b', owners: ['ou_owner'] },
                bad: { channel: 1 },
            }),
        );
        expect(chats.oc_1).toEqual({ channel: 'canteen-a', operators: ['ou_a', 'ou_b'], owners: ['ou_owner'] });
        expect(chats.bad).toBeUndefined();
    });

    it('坏 JSON 不抛错，退回空表', () => {
        expect(parseChatMap('{oops')).toEqual({});
    });

    it('enabled=true 但无发送通道时自动禁用', () => {
        const s = readFeishuSettings({ FEISHU_ENABLED: 'true' } as NodeJS.ProcessEnv);
        expect(s.enabled).toBe(false);
        expect(s.digestAt).toBe('08:30');
    });

    it('汇总时间只接受 HH:mm，否则退回默认', () => {
        expect(readFeishuSettings({ FEISHU_DIGEST_AT: '09:05' } as NodeJS.ProcessEnv).digestAt).toBe('09:05');
        expect(readFeishuSettings({ FEISHU_DIGEST_AT: '9:5' } as NodeJS.ProcessEnv).digestAt).toBe('08:30');
    });
});

describe('feishu webhook signature', () => {
    it('带 secret 时 payload 含 timestamp 与 sign，且签名可复算', () => {
        const now = 1_700_000_000_000;
        const payload: any = buildWebhookPayload('hello', 's3cret', now);
        expect(payload.timestamp).toBe(String(Math.floor(now / 1000)));
        expect(payload.sign).toBe(buildWebhookSignature(payload.timestamp, 's3cret'));
        expect(payload.msg_type).toBe('text');
        expect(payload.content).toEqual({ text: 'hello' });
    });

    it('无 secret 时不加签字段', () => {
        const payload: any = buildWebhookPayload('hi');
        expect(payload.sign).toBeUndefined();
        expect(payload.timestamp).toBeUndefined();
    });
});

describe('feishu templates', () => {
    it('推送文案包含场景标签、单号与 UTC+8 时间', () => {
        const text = formatPush({
            scene: 'shop_new_order',
            title: '新订单',
            content: '金额 ¥18.00',
            orderCode: 'A1',
            at: Date.UTC(2026, 0, 2, 1, 30),
        });
        expect(text).toContain('【新订单】');
        expect(text).toContain('订单：A1');
        expect(text).toContain('2026-01-02 09:30');
    });

    it('看板与汇总文案含营业状态与金额', () => {
        const board = {
            paused: false,
            storeName: '一食堂',
            pending: [{ code: 'A1' }],
            cooking: [],
            awaitingRider: [],
            delivering: [],
            completedToday: 3,
            completedTodayAmount: 4500,
        };
        const b = formatBoard(board);
        expect(b).toContain('营业中');
        expect(b).toContain('待接单 1（A1）');
        expect(b).toContain('¥45.00');

        const d = formatDigest({
            ...board,
            date: '2026-10-24',
            totalOrders: 12,
            onTimeRate: 92,
            cancelled: 1,
            exceptionCount: 2,
        });
        expect(d).toContain('2026-10-24');
        expect(d).toContain('订单量 12（取消 1）');
        expect(d).toContain('准点率 92%');
    });
});

describe('feishu digest time gate', () => {
    it('按 UTC+8 输出 HH:mm（跨日不漂移）', () => {
        expect(campusHhmm(Date.UTC(2026, 0, 1, 0, 30))).toBe('08:30');
        expect(campusHhmm(Date.UTC(2026, 0, 1, 16, 5))).toBe('00:05');
    });
});
