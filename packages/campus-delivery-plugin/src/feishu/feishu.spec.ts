import { createCipheriv, createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import { buildWebhookPayload, buildWebhookSignature } from './feishu.client';
import { parseCommand, requiredRole } from './feishu.command.service';
import { parseChatMap, readFeishuSettings } from './feishu.config';
import { decryptFeishuPayload } from './feishu.crypto';
import { campusHhmm } from './feishu.digest.service';
import { formatBoard, formatDigest, formatExceptions, formatOrderStatus, formatPlatformBoard, formatPlatformDigest, formatPush } from './feishu.templates';

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

    it('平台管理群指令：查单 / 异常 / 带店铺开关店', () => {
        expect(parseCommand('查 A1234')).toEqual({ name: 'status', orderCode: 'A1234' });
        expect(parseCommand('异常')).toEqual({ name: 'exceptions' });
        expect(parseCommand('关店 canteen-a')).toEqual({ name: 'close', store: 'canteen-a' });
        expect(parseCommand('开店 canteen-b')).toEqual({ name: 'open', store: 'canteen-b' });
        expect(requiredRole('status')).toBe('operator');
        expect(requiredRole('exceptions')).toBe('operator');
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
        expect(chats.oc_1).toEqual({
            scope: 'channel',
            channel: 'canteen-a',
            operators: ['ou_a', 'ou_b'],
            owners: ['ou_owner'],
        });
        expect(chats.bad).toBeUndefined();
    });

    it('平台管理群：scope=platform 或 channel=* 均可，且不绑定店铺', () => {
        const chats = parseChatMap(
            JSON.stringify({
                oc_admin: { scope: 'platform', operators: 'ou_a', owners: 'ou_b' },
                oc_admin2: { channel: '*', operators: ['ou_a'], owners: ['ou_b'] },
            }),
        );
        expect(chats.oc_admin).toEqual({ scope: 'platform', channel: undefined, operators: ['ou_a'], owners: ['ou_b'] });
        expect(chats.oc_admin2.scope).toBe('platform');
        expect(chats.oc_admin2.channel).toBeUndefined();
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

    it('跨店看板汇总多店铺并进行中/完成合计', () => {
        const text = formatPlatformBoard({
            at: Date.UTC(2026, 0, 2, 1, 30),
            exceptions: ['A9 canteen-a 骑手失联（已 12 分钟）'],
            overdue: ['A8 canteen-b 商户 8 分钟未接单（阈值 5）'],
            stores: [
                {
                    name: 'canteen-a',
                    paused: false,
                    pending: 2,
                    pendingCodes: ['A1', 'A2'],
                    cooking: 1,
                    awaitingRider: 0,
                    delivering: 1,
                    pendingDispatch: 0,
                    thirdParty: 0,
                    ownedPool: 0,
                    ownedDispatched: 0,
                    merchantDelivering: 0,
                    completedToday: 5,
                    completedTodayAmount: 12000,
                    exceptionCount: 1,
                },
                {
                    name: 'canteen-b',
                    paused: true,
                    pending: 0,
                    pendingCodes: [],
                    cooking: 0,
                    awaitingRider: 0,
                    delivering: 0,
                    pendingDispatch: 0,
                    thirdParty: 0,
                    ownedPool: 0,
                    ownedDispatched: 0,
                    merchantDelivering: 0,
                    completedToday: 1,
                    completedTodayAmount: 1800,
                    exceptionCount: 0,
                },
            ],
        });
        expect(text).toContain('【跨店看板】2026-01-02 09:30');
        expect(text).toContain('canteen-a 营业中｜待接单 2（A1、A2）');
        expect(text).toContain('canteen-b 已暂停');
        expect(text).toContain('合计：进行中 4 单｜今日完成 6 单 ¥138.00');
        expect(text).toContain('【异常未处置 1】');
        expect(text).toContain('【超时风险 1】');
    });

    it('全平台汇总逐店 + 合计行', () => {
        const text = formatPlatformDigest({
            date: '2026-10-24',
            stores: [{ name: 'canteen-a', completed: 8, amount: 16800, onTimeRate: 95, cancelled: 1, exception: 0 }],
            totalOrders: 10,
            cancelled: 1,
            completed: 8,
            amount: 16800,
            onTimeRate: 95,
            exception: 0,
        });
        expect(text).toContain('【每日汇总】2026-10-24 全平台');
        expect(text).toContain('canteen-a 完成 8 单 ¥168.00');
        expect(text).toContain('合计：订单 10（取消 1）');
    });

    it('异常清单为空时给出明确提示', () => {
        expect(formatExceptions([], [])).toContain('当前没有异常或超时订单');
        expect(formatExceptions(['A1 canteen-a 异常未处置'], [])).toContain('【异常未处置 1】');
    });

    it('单号查询展示配送环节、骑手与异常耗时', () => {
        const text = formatOrderStatus({
            code: 'A1',
            store: 'canteen-a',
            orderState: 'ArrangingPayment',
            hallStatus: 'grabbed',
            deliveryStatus: 'picked',
            route: '一食堂 → 3 号宿舍楼',
            riderName: '张三',
            building: '3 号宿舍楼',
            zone: '北区',
            slotText: '12:00-12:30',
            total: 2500,
            exceptionType: '骑手失联',
            exceptionNote: '联系不上',
            exceptionMinutes: 12,
            createdAt: Date.UTC(2026, 0, 2, 1, 0),
            at: Date.UTC(2026, 0, 2, 1, 40),
        });
        expect(text).toContain('【订单 A1】canteen-a');
        expect(text).toContain('配送环节：骑手已接单（已取货）');
        expect(text).toContain('骑手：张三');
        expect(text).toContain('异常：骑手失联｜联系不上（已上报 12 分钟）');
        expect(text).toContain('已过 40 分钟');
    });
});

describe('feishu digest time gate', () => {
    it('按 UTC+8 输出 HH:mm（跨日不漂移）', () => {
        expect(campusHhmm(Date.UTC(2026, 0, 1, 0, 30))).toBe('08:30');
        expect(campusHhmm(Date.UTC(2026, 0, 1, 16, 5))).toBe('00:05');
    });
});
