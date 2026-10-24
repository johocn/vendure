import { createCipheriv, createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import { buildWebhookPayload, buildWebhookSignature } from './feishu.client';
import { AUDIT_TABLE_SQL, buildRestoreSQL, parseCommand, requiredRole } from './feishu.command.service';
import { parseChatMap, readFeishuSettings } from './feishu.config';
import { decryptFeishuPayload } from './feishu.crypto';
import { campusHhmm } from './feishu.digest.service';
import {
    buildOrderCard,
    buildSearchCard,
    buildTemplateCard,
    extractOrderCodeFromCard,
    extractOrderCodeFromText,
    formatBoard,
    formatDigest,
    formatExceptions,
    formatOrderStatus,
    formatPlatformBoard,
    formatPlatformDigest,
    formatPush,
    matchReplyTemplate,
    REPLY_TEMPLATES,
    replyTemplateText,
    shortCode,
} from './feishu.templates';

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

describe('feishu 零建表卡片', () => {
    const view = {
        code: 'CAMPUS202610240001',
        store: 'canteen-a',
        orderState: 'ArrangingPayment',
        hallStatus: 'pending_merchant',
        deliveryStatus: null,
        route: null,
        riderName: null,
        building: '3 号宿舍楼',
        zone: '北区',
        slotText: '12:00-12:30',
        total: 2500,
        exceptionType: null,
        exceptionNote: null,
        exceptionMinutes: null,
        createdAt: Date.UTC(2026, 0, 2, 1, 0),
        at: Date.UTC(2026, 0, 2, 1, 6),
    };

    it('短码只取尾 4 位且大写，完整单号不进标题', () => {
        expect(shortCode('CAMPUS202610240001')).toBe('0001');
        expect(shortCode('ab-12cd')).toBe('12CD');
        const card: any = buildOrderCard(view);
        expect(card.header.title.content).toContain('0001');
        expect(card.header.title.content).not.toContain('CAMPUS202610240001');
        expect(JSON.stringify(card)).toContain('CAMPUS202610240001');
    });

    it('待接单卡片带「接单」按钮，value 携带完整单号', () => {
        const card: any = buildOrderCard(view);
        const actions = card.elements.find((e: any) => e.tag === 'action');
        const accept = actions.actions.find((b: any) => b.text.content === '接单');
        expect(accept.value).toEqual({ a: 'accept', c: 'CAMPUS202610240001' });
        expect(actions.actions.map((b: any) => b.text.content)).toContain('快捷回复');
    });

    it('异常订单卡片用红色标题并展示异常原因', () => {
        const card: any = buildOrderCard({
            ...view,
            hallStatus: 'exception',
            deliveryStatus: 'exception',
            exceptionType: '骑手失联',
            exceptionNote: '联系不上',
            exceptionMinutes: 12,
        });
        expect(card.header.template).toBe('red');
        expect(JSON.stringify(card)).toContain('骑手失联');
    });

    it('检索卡片最多 4 行且按钮带完整单号', () => {
        const rows = Array.from({ length: 8 }, (_, i) => ({
            code: `CAMPUS2026102400${i}`,
            store: 'canteen-a',
            hallStatus: 'pending_merchant',
            building: '3 号宿舍楼',
            createdAt: Date.UTC(2026, 0, 2, 1, i),
        }));
        const card: any = buildSearchCard('3 号', rows);
        expect(card.header.title.content).toContain('8 条');
        expect(card.elements.filter((e: any) => e.tag === 'action').length).toBe(4);
        expect(JSON.stringify(card)).toContain('CAMPUS20261024003');
        expect(JSON.stringify(card)).not.toContain('CAMPUS20261024004');
    });

    it('卡片 JSON 可回读出完整单号（引用/话题绑定）', () => {
        const card = buildOrderCard(view);
        const content = JSON.stringify(card);
        expect(extractOrderCodeFromCard(content)).toBe('CAMPUS202610240001');
        expect(extractOrderCodeFromCard('not json')).toBeUndefined();
        expect(extractOrderCodeFromText('订单 CAMPUS202610240001 请尽快接单')).toBe('CAMPUS202610240001');
    });

    it('引用卡片回复模板名/别名可匹配，文本带完整单号', () => {
        const tpl = matchReplyTemplate('催单');
        expect(tpl?.id).toBe('urge_accept');
        expect(matchReplyTemplate('  已联系顾客！ ')?.id).toBe('contacted_customer');
        expect(matchReplyTemplate('随便说点什么')).toBeUndefined();
        expect(replyTemplateText(tpl!, 'A1')).toContain('订单 A1');

        const card: any = buildTemplateCard('A1');
        const values = card.elements.filter((e: any) => e.tag === 'action')
            .flatMap((e: any) => e.actions.map((b: any) => b.value));
        expect(values.length).toBe(REPLY_TEMPLATES.length);
        expect(values[0]).toEqual({ a: 'tpl', c: 'A1', t: 'urge_accept' });
    });

    it('异常卡片按钮：改派(primary)→已处置→退差价→发券→全额退款(danger)，不再出现报异常', () => {
        const now = Date.now();
        const card: any = buildOrderCard({
            code: 'CAMPUS2026102412345ABCDE',
            store: 'canteen-a',
            hallStatus: 'open',
            deliveryStatus: 'exception',
            exceptionType: '骑手联系不上',
            exceptionNote: '测试单',
            exceptionMinutes: 20,
            createdAt: now - 30 * 60_000,
            at: now,
            building: '3 号宿舍楼',
            riderName: null,
            route: 'R2',
            total: 1800,
        } as any);
        const actionElem = card.elements.find((e: any) => e.tag === 'action');
        const btnLabels = actionElem.actions.map((b: any) => b.text.content);
        const btnTypes = actionElem.actions.map((b: any) => b.type);
        const btnA = actionElem.actions.map((b: any) => b.value.a);
        // 5 个异常处置按钮 + 状态 + 快捷回复 = 7
        expect(btnLabels.length).toBe(7);
        // 序列：改派(primary) → 已处置 → 退差价 → 发券 → 全额退款(danger) → 状态 → 快捷回复
        expect(btnLabels).toEqual(['改派', '已处置', '退差价', '发券', '全额退款', '状态', '快捷回复']);
        expect(btnTypes[0]).toBe('primary');
        expect(btnTypes[4]).toBe('danger');
        expect(btnA.slice(0, 5)).toEqual(['reassign', 'handled', 'refund_diff', 'coupon', 'refund_all']);
        expect(btnLabels).not.toContain('报异常');
    });

    it('非异常卡片：按 hallStatus 显示接单/出餐 primary', () => {
        const now = Date.now();
        const pendingCard: any = buildOrderCard({
            code: 'ABC123456789XYZ', store: 'canteen-a',
            hallStatus: 'pending_merchant', createdAt: now - 2 * 60_000, at: now,
        } as any);
        const labels = pendingCard.elements.find((e: any) => e.tag === 'action')
            .actions.map((b: any) => b.text.content);
        expect(labels[0]).toBe('接单'); // primary 位

        const acceptedCard: any = buildOrderCard({
            code: 'ABC123456789XYZ', store: 'canteen-a',
            hallStatus: 'accepted', createdAt: now - 10 * 60_000, at: now,
        } as any);
        const acceptedLabels = acceptedCard.elements.find((e: any) => e.tag === 'action')
            .actions.map((b: any) => b.text.content);
        expect(acceptedLabels[0]).toBe('出餐'); // primary 位
    });

    // ---------- P1.2 restore 指令 ----------

    it('parseCommand 解析 restore / 恢复 指令', () => {
        expect(parseCommand('恢复 ABC123').name).toBe('restore');
        expect(parseCommand('恢复 ABC123').orderCode).toBe('ABC123');
        expect(parseCommand('restore XYZ999').name).toBe('restore');
        expect(parseCommand('restore XYZ999').orderCode).toBe('XYZ999');
        expect(parseCommand('恢复').name).toBe('restore');
        expect(parseCommand('恢复').orderCode).toBeUndefined();
    });

    // ---------- P2.2 即将超时看板 ----------

    it('formatExceptions 三段输出：异常未处置 / 已超时 / 即将超时 ⚠️', () => {
        const text = formatExceptions(
            ['CODE1 store 骑手失联（已 30 分钟）'],
            ['CODE2 store 商户 8 分钟未接单（阈值 5）'],
            ['CODE3 store ⚠️ 骑手即将超时（14/15min）'],
        );
        expect(text).toContain('【异常未处置 1】');
        expect(text).toContain('CODE1');
        expect(text).toContain('【已超时 1】');
        expect(text).toContain('CODE2');
        expect(text).toContain('【即将超时 ⚠️ 1】');
        expect(text).toContain('CODE3');
    });

    it('formatExceptions 空 soonOverdue 不崩溃', () => {
        expect(formatExceptions([], [], [])).toBe('当前没有异常或超时订单。');
        expect(formatExceptions(['A1'], [], [])).toContain('【异常未处置 1】');
        expect(formatExceptions([], ['B2'], [])).toContain('【已超时 1】');
    });

    // ---------- P2.1 同单告警合并（FeishuCardService.appendAlert 需要 mock client，这里测纯模板层） ----------

    it('buildOrderCard header 状态 emoji 按 hallStatus 正确渲染', () => {
        const now = Date.now();
        const cases: Array<[string, string, string]> = [
            ['pending_merchant', '🟠', '待商户接单'],
            ['accepted', '🔵', '备餐中'],
            ['open', '🟢', '待抢单'],
        ];
        for (const [hs, emoji, label] of cases) {
            const card: any = buildOrderCard({
                code: 'EMOJITEST1234567', store: 'canteen-a',
                hallStatus: hs, createdAt: now - 5 * 60_000, at: now,
            } as any);
            const title = card.header.title.content;
            expect(title).toContain(emoji);
            expect(title).toContain(label);
        }
    });

    // ---------- Bug 9 回归测试：confirmRestore SQL 不含幽灵列 ----------

    it('Bug 9 回归：buildRestoreSQL 不含 customFieldsExceptionfinal 幽灵列', () => {
        // 历史 bug: 曾硬写 customFieldsExceptionfinal=FLASE——custom-fields.ts 未定义
        // PostgreSQL 会报 column does not exist，恢复功能完全不可用
        const { sql, fields } = buildRestoreSQL();
        expect(sql).not.toMatch(/exceptionfinal/i); // 不区分大小写
        expect(sql).not.toMatch(/exception_final/i);
        // 必须包含真正有用的清理字段
        expect(sql).toContain('"customFieldsHallstatus"');
        expect(sql).toContain('"customFieldsExceptionaction"');
        expect(sql).toContain('"customFieldsExceptionhandledat"');
        expect(fields.length).toBeGreaterThanOrEqual(4);
        // PG 回归：每个列名必须双引号（裸写会被折叠成小写 → column does not exist）
        for (const f of fields) {
            const col = f.split('=')[0];
            expect(col).toMatch(/^"customFields[A-Za-z]+"$/);
        }
    });

    it('Bug 9 回归：AUDIT_TABLE_SQL 建表语句合法且字段齐全', () => {
        // audit 日志零 migration：首次 audit 时 CREATE TABLE IF NOT EXISTS
        expect(AUDIT_TABLE_SQL).toContain('CREATE TABLE IF NOT EXISTS feishu_audit_log');
        expect(AUDIT_TABLE_SQL).toContain('bigserial'); // 自增主键
        expect(AUDIT_TABLE_SQL).toContain('timestamptz'); // 带时区
        expect(AUDIT_TABLE_SQL).toContain('cmd_name');
        expect(AUDIT_TABLE_SQL).toContain('card_action');
        expect(AUDIT_TABLE_SQL).toContain('order_code');
        expect(AUDIT_TABLE_SQL).toContain('result');
    });
});
