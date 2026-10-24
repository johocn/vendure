"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const vitest_1 = require("vitest");
const feishu_client_1 = require("./feishu.client");
const feishu_command_service_1 = require("./feishu.command.service");
const feishu_config_1 = require("./feishu.config");
const feishu_crypto_1 = require("./feishu.crypto");
const feishu_digest_service_1 = require("./feishu.digest.service");
const feishu_templates_1 = require("./feishu.templates");
function encrypt(plain, encryptKey) {
    const key = (0, crypto_1.createHash)('sha256').update(encryptKey).digest();
    const iv = Buffer.alloc(16, 7);
    const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, iv);
    return Buffer.concat([iv, cipher.update(plain, 'utf8'), cipher.final()]).toString('base64');
}
(0, vitest_1.describe)('feishu crypto', () => {
    (0, vitest_1.it)('解密飞书 AES-256-CBC 事件体', () => {
        const body = { header: { event_type: 'im.message.receive_v1' }, challenge: 'abc' };
        const decoded = (0, feishu_crypto_1.decryptFeishuPayload)(encrypt(JSON.stringify(body), 'k-123'), 'k-123');
        (0, vitest_1.expect)(decoded).toEqual(body);
    });
    (0, vitest_1.it)('密文损坏/密钥为空时返回 null 而不是抛错', () => {
        (0, vitest_1.expect)((0, feishu_crypto_1.decryptFeishuPayload)('not-base64!!', 'k')).toBeNull();
        (0, vitest_1.expect)((0, feishu_crypto_1.decryptFeishuPayload)('', 'k')).toBeNull();
        (0, vitest_1.expect)((0, feishu_crypto_1.decryptFeishuPayload)(encrypt('{}', 'k'), '')).toBeNull();
        (0, vitest_1.expect)((0, feishu_crypto_1.decryptFeishuPayload)(encrypt('{}', 'k'), 'wrong-key')).toBeNull();
    });
});
(0, vitest_1.describe)('feishu command parsing', () => {
    (0, vitest_1.it)('识别中文指令与单号', () => {
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('待处理')).toEqual({ name: 'board' });
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('接单 A1234')).toEqual({ name: 'accept', orderCode: 'A1234' });
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('拒单 A1234 缺货')).toEqual({
            name: 'reject',
            orderCode: 'A1234',
            reason: '缺货',
        });
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('确认拒单 A1234')).toEqual({ name: 'confirmReject', orderCode: 'A1234' });
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('关店').name).toBe('close');
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('帮助').name).toBe('help');
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('随便说点什么').name).toBe('unknown');
    });
    (0, vitest_1.it)('平台管理群指令：查单 / 异常 / 带店铺开关店', () => {
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('查 A1234')).toEqual({ name: 'status', orderCode: 'A1234' });
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('异常')).toEqual({ name: 'exceptions' });
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('关店 canteen-a')).toEqual({ name: 'close', store: 'canteen-a' });
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('开店 canteen-b')).toEqual({ name: 'open', store: 'canteen-b' });
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('status')).toBe('operator');
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('exceptions')).toBe('operator');
    });
    (0, vitest_1.it)('去掉 @ 提及与多余空白后再解析', () => {
        (0, vitest_1.expect)((0, feishu_command_service_1.parseCommand)('  @_user_1   接单   A1234  ')).toEqual({ name: 'accept', orderCode: 'A1234' });
    });
    (0, vitest_1.it)('权限分级：拒单/开关店需店主，接单/看板仅需操作员', () => {
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('accept')).toBe('operator');
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('board')).toBe('operator');
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('reject')).toBe('owner');
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('confirmReject')).toBe('owner');
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('close')).toBe('owner');
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('help')).toBe('none');
        (0, vitest_1.expect)((0, feishu_command_service_1.requiredRole)('unknown')).toBe('none');
    });
});
(0, vitest_1.describe)('feishu settings', () => {
    (0, vitest_1.it)('FEISHU_CHAT_MAP 支持数组与逗号分隔两种白名单写法', () => {
        const chats = (0, feishu_config_1.parseChatMap)(JSON.stringify({
            oc_1: { channel: 'canteen-a', operators: 'ou_a,ou_b', owners: ['ou_owner'] },
            bad: { channel: 1 },
        }));
        (0, vitest_1.expect)(chats.oc_1).toEqual({
            scope: 'channel',
            channel: 'canteen-a',
            operators: ['ou_a', 'ou_b'],
            owners: ['ou_owner'],
        });
        (0, vitest_1.expect)(chats.bad).toBeUndefined();
    });
    (0, vitest_1.it)('平台管理群：scope=platform 或 channel=* 均可，且不绑定店铺', () => {
        const chats = (0, feishu_config_1.parseChatMap)(JSON.stringify({
            oc_admin: { scope: 'platform', operators: 'ou_a', owners: 'ou_b' },
            oc_admin2: { channel: '*', operators: ['ou_a'], owners: ['ou_b'] },
        }));
        (0, vitest_1.expect)(chats.oc_admin).toEqual({ scope: 'platform', channel: undefined, operators: ['ou_a'], owners: ['ou_b'] });
        (0, vitest_1.expect)(chats.oc_admin2.scope).toBe('platform');
        (0, vitest_1.expect)(chats.oc_admin2.channel).toBeUndefined();
    });
    (0, vitest_1.it)('坏 JSON 不抛错，退回空表', () => {
        (0, vitest_1.expect)((0, feishu_config_1.parseChatMap)('{oops')).toEqual({});
    });
    (0, vitest_1.it)('enabled=true 但无发送通道时自动禁用', () => {
        const s = (0, feishu_config_1.readFeishuSettings)({ FEISHU_ENABLED: 'true' });
        (0, vitest_1.expect)(s.enabled).toBe(false);
        (0, vitest_1.expect)(s.digestAt).toBe('08:30');
    });
    (0, vitest_1.it)('汇总时间只接受 HH:mm，否则退回默认', () => {
        (0, vitest_1.expect)((0, feishu_config_1.readFeishuSettings)({ FEISHU_DIGEST_AT: '09:05' }).digestAt).toBe('09:05');
        (0, vitest_1.expect)((0, feishu_config_1.readFeishuSettings)({ FEISHU_DIGEST_AT: '9:5' }).digestAt).toBe('08:30');
    });
});
(0, vitest_1.describe)('feishu webhook signature', () => {
    (0, vitest_1.it)('带 secret 时 payload 含 timestamp 与 sign，且签名可复算', () => {
        const now = 1700000000000;
        const payload = (0, feishu_client_1.buildWebhookPayload)('hello', 's3cret', now);
        (0, vitest_1.expect)(payload.timestamp).toBe(String(Math.floor(now / 1000)));
        (0, vitest_1.expect)(payload.sign).toBe((0, feishu_client_1.buildWebhookSignature)(payload.timestamp, 's3cret'));
        (0, vitest_1.expect)(payload.msg_type).toBe('text');
        (0, vitest_1.expect)(payload.content).toEqual({ text: 'hello' });
    });
    (0, vitest_1.it)('无 secret 时不加签字段', () => {
        const payload = (0, feishu_client_1.buildWebhookPayload)('hi');
        (0, vitest_1.expect)(payload.sign).toBeUndefined();
        (0, vitest_1.expect)(payload.timestamp).toBeUndefined();
    });
});
(0, vitest_1.describe)('feishu templates', () => {
    (0, vitest_1.it)('推送文案包含场景标签、单号与 UTC+8 时间', () => {
        const text = (0, feishu_templates_1.formatPush)({
            scene: 'shop_new_order',
            title: '新订单',
            content: '金额 ¥18.00',
            orderCode: 'A1',
            at: Date.UTC(2026, 0, 2, 1, 30),
        });
        (0, vitest_1.expect)(text).toContain('【新订单】');
        (0, vitest_1.expect)(text).toContain('订单：A1');
        (0, vitest_1.expect)(text).toContain('2026-01-02 09:30');
    });
    (0, vitest_1.it)('看板与汇总文案含营业状态与金额', () => {
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
        const b = (0, feishu_templates_1.formatBoard)(board);
        (0, vitest_1.expect)(b).toContain('营业中');
        (0, vitest_1.expect)(b).toContain('待接单 1（A1）');
        (0, vitest_1.expect)(b).toContain('¥45.00');
        const d = (0, feishu_templates_1.formatDigest)(Object.assign(Object.assign({}, board), { date: '2026-10-24', totalOrders: 12, onTimeRate: 92, cancelled: 1, exceptionCount: 2 }));
        (0, vitest_1.expect)(d).toContain('2026-10-24');
        (0, vitest_1.expect)(d).toContain('订单量 12（取消 1）');
        (0, vitest_1.expect)(d).toContain('准点率 92%');
    });
    (0, vitest_1.it)('跨店看板汇总多店铺并进行中/完成合计', () => {
        const text = (0, feishu_templates_1.formatPlatformBoard)({
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
        (0, vitest_1.expect)(text).toContain('【跨店看板】2026-01-02 09:30');
        (0, vitest_1.expect)(text).toContain('canteen-a 营业中｜待接单 2（A1、A2）');
        (0, vitest_1.expect)(text).toContain('canteen-b 已暂停');
        (0, vitest_1.expect)(text).toContain('合计：进行中 4 单｜今日完成 6 单 ¥138.00');
        (0, vitest_1.expect)(text).toContain('【异常未处置 1】');
        (0, vitest_1.expect)(text).toContain('【超时风险 1】');
    });
    (0, vitest_1.it)('全平台汇总逐店 + 合计行', () => {
        const text = (0, feishu_templates_1.formatPlatformDigest)({
            date: '2026-10-24',
            stores: [{ name: 'canteen-a', completed: 8, amount: 16800, onTimeRate: 95, cancelled: 1, exception: 0 }],
            totalOrders: 10,
            cancelled: 1,
            completed: 8,
            amount: 16800,
            onTimeRate: 95,
            exception: 0,
        });
        (0, vitest_1.expect)(text).toContain('【每日汇总】2026-10-24 全平台');
        (0, vitest_1.expect)(text).toContain('canteen-a 完成 8 单 ¥168.00');
        (0, vitest_1.expect)(text).toContain('合计：订单 10（取消 1）');
    });
    (0, vitest_1.it)('异常清单为空时给出明确提示', () => {
        (0, vitest_1.expect)((0, feishu_templates_1.formatExceptions)([], [])).toContain('当前没有异常或超时订单');
        (0, vitest_1.expect)((0, feishu_templates_1.formatExceptions)(['A1 canteen-a 异常未处置'], [])).toContain('【异常未处置 1】');
    });
    (0, vitest_1.it)('单号查询展示配送环节、骑手与异常耗时', () => {
        const text = (0, feishu_templates_1.formatOrderStatus)({
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
        (0, vitest_1.expect)(text).toContain('【订单 A1】canteen-a');
        (0, vitest_1.expect)(text).toContain('配送环节：骑手已接单（已取货）');
        (0, vitest_1.expect)(text).toContain('骑手：张三');
        (0, vitest_1.expect)(text).toContain('异常：骑手失联｜联系不上（已上报 12 分钟）');
        (0, vitest_1.expect)(text).toContain('已过 40 分钟');
    });
});
(0, vitest_1.describe)('feishu digest time gate', () => {
    (0, vitest_1.it)('按 UTC+8 输出 HH:mm（跨日不漂移）', () => {
        (0, vitest_1.expect)((0, feishu_digest_service_1.campusHhmm)(Date.UTC(2026, 0, 1, 0, 30))).toBe('08:30');
        (0, vitest_1.expect)((0, feishu_digest_service_1.campusHhmm)(Date.UTC(2026, 0, 1, 16, 5))).toBe('00:05');
    });
});
(0, vitest_1.describe)('feishu 零建表卡片', () => {
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
    (0, vitest_1.it)('短码只取尾 4 位且大写，完整单号不进标题', () => {
        (0, vitest_1.expect)((0, feishu_templates_1.shortCode)('CAMPUS202610240001')).toBe('0001');
        (0, vitest_1.expect)((0, feishu_templates_1.shortCode)('ab-12cd')).toBe('12CD');
        const card = (0, feishu_templates_1.buildOrderCard)(view);
        (0, vitest_1.expect)(card.header.title.content).toContain('0001');
        (0, vitest_1.expect)(card.header.title.content).not.toContain('CAMPUS202610240001');
        (0, vitest_1.expect)(JSON.stringify(card)).toContain('CAMPUS202610240001');
    });
    (0, vitest_1.it)('待接单卡片带「接单」按钮，value 携带完整单号', () => {
        const card = (0, feishu_templates_1.buildOrderCard)(view);
        const actions = card.elements.find((e) => e.tag === 'action');
        const accept = actions.actions.find((b) => b.text.content === '接单');
        (0, vitest_1.expect)(accept.value).toEqual({ a: 'accept', c: 'CAMPUS202610240001' });
        (0, vitest_1.expect)(actions.actions.map((b) => b.text.content)).toContain('快捷回复');
    });
    (0, vitest_1.it)('异常订单卡片用红色标题并展示异常原因', () => {
        const card = (0, feishu_templates_1.buildOrderCard)(Object.assign(Object.assign({}, view), { hallStatus: 'exception', deliveryStatus: 'exception', exceptionType: '骑手失联', exceptionNote: '联系不上', exceptionMinutes: 12 }));
        (0, vitest_1.expect)(card.header.template).toBe('red');
        (0, vitest_1.expect)(JSON.stringify(card)).toContain('骑手失联');
    });
    (0, vitest_1.it)('检索卡片最多 4 行且按钮带完整单号', () => {
        const rows = Array.from({ length: 8 }, (_, i) => ({
            code: `CAMPUS2026102400${i}`,
            store: 'canteen-a',
            hallStatus: 'pending_merchant',
            building: '3 号宿舍楼',
            createdAt: Date.UTC(2026, 0, 2, 1, i),
        }));
        const card = (0, feishu_templates_1.buildSearchCard)('3 号', rows);
        (0, vitest_1.expect)(card.header.title.content).toContain('8 条');
        (0, vitest_1.expect)(card.elements.filter((e) => e.tag === 'action').length).toBe(4);
        (0, vitest_1.expect)(JSON.stringify(card)).toContain('CAMPUS20261024003');
        (0, vitest_1.expect)(JSON.stringify(card)).not.toContain('CAMPUS20261024004');
    });
    (0, vitest_1.it)('卡片 JSON 可回读出完整单号（引用/话题绑定）', () => {
        const card = (0, feishu_templates_1.buildOrderCard)(view);
        const content = JSON.stringify(card);
        (0, vitest_1.expect)((0, feishu_templates_1.extractOrderCodeFromCard)(content)).toBe('CAMPUS202610240001');
        (0, vitest_1.expect)((0, feishu_templates_1.extractOrderCodeFromCard)('not json')).toBeUndefined();
        (0, vitest_1.expect)((0, feishu_templates_1.extractOrderCodeFromText)('订单 CAMPUS202610240001 请尽快接单')).toBe('CAMPUS202610240001');
    });
    (0, vitest_1.it)('引用卡片回复模板名/别名可匹配，文本带完整单号', () => {
        var _a;
        const tpl = (0, feishu_templates_1.matchReplyTemplate)('催单');
        (0, vitest_1.expect)(tpl === null || tpl === void 0 ? void 0 : tpl.id).toBe('urge_accept');
        (0, vitest_1.expect)((_a = (0, feishu_templates_1.matchReplyTemplate)('  已联系顾客！ ')) === null || _a === void 0 ? void 0 : _a.id).toBe('contacted_customer');
        (0, vitest_1.expect)((0, feishu_templates_1.matchReplyTemplate)('随便说点什么')).toBeUndefined();
        (0, vitest_1.expect)((0, feishu_templates_1.replyTemplateText)(tpl, 'A1')).toContain('订单 A1');
        const card = (0, feishu_templates_1.buildTemplateCard)('A1');
        const values = card.elements.filter((e) => e.tag === 'action')
            .flatMap((e) => e.actions.map((b) => b.value));
        (0, vitest_1.expect)(values.length).toBe(feishu_templates_1.REPLY_TEMPLATES.length);
        (0, vitest_1.expect)(values[0]).toEqual({ a: 'tpl', c: 'A1', t: 'urge_accept' });
    });
});
//# sourceMappingURL=feishu.spec.js.map