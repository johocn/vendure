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
        (0, vitest_1.expect)(chats.oc_1).toEqual({ channel: 'canteen-a', operators: ['ou_a', 'ou_b'], owners: ['ou_owner'] });
        (0, vitest_1.expect)(chats.bad).toBeUndefined();
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
});
(0, vitest_1.describe)('feishu digest time gate', () => {
    (0, vitest_1.it)('按 UTC+8 输出 HH:mm（跨日不漂移）', () => {
        (0, vitest_1.expect)((0, feishu_digest_service_1.campusHhmm)(Date.UTC(2026, 0, 1, 0, 30))).toBe('08:30');
        (0, vitest_1.expect)((0, feishu_digest_service_1.campusHhmm)(Date.UTC(2026, 0, 1, 16, 5))).toBe('00:05');
    });
});
//# sourceMappingURL=feishu.spec.js.map