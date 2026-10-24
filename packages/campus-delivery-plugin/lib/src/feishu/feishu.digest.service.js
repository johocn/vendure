"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuDigestService = void 0;
exports.campusHhmm = campusHhmm;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_time_1 = require("../campus-time");
const feishu_config_1 = require("./feishu.config");
const feishu_client_1 = require("./feishu.client");
const feishu_command_service_1 = require("./feishu.command.service");
const loggerCtx = 'Feishu';
const DIGEST_TABLE = 'feishu_digest_state';
/** 当前校园时区 HH:mm */
function campusHhmm(t) {
    const d = new Date(t + campus_time_1.CAMPUS_TZ_OFFSET_MS);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
/** 到达汇总时间且今天未发 → 逐群推送当天经营汇总（advisory lock + 落库标记，防多进程/重发） */
let FeishuDigestService = class FeishuDigestService {
    constructor(cfg, client, connection, command) {
        this.cfg = cfg;
        this.client = client;
        this.connection = connection;
        this.command = command;
        this.running = false;
        this.ready = false;
    }
    start(intervalMs = 60000) {
        if (this.timer || !this.client.enabled)
            return;
        this.timer = setInterval(() => {
            void this.tick().catch(e => { var _a; return core_1.Logger.error(`digest tick: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx); });
        }, intervalMs);
        core_1.Logger.info(`每日汇总已启用，时间 ${this.cfg.settings.digestAt}（UTC+8）`, loggerCtx);
    }
    onApplicationShutdown() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = undefined;
    }
    async tick() {
        if (!this.cfg.enabled || this.running)
            return;
        if (campusHhmm(Date.now()) < this.cfg.settings.digestAt)
            return;
        this.running = true;
        try {
            if (!this.ready) {
                await this.ensureStateTable();
                this.ready = true;
            }
            for (const [chatId, chat] of Object.entries(this.cfg.settings.chats)) {
                await this.sendOnce(chatId, chat);
            }
        }
        finally {
            this.running = false;
        }
    }
    async sendOnce(chatId, chat) {
        var _a;
        const day = (0, campus_time_1.campusDayKey)(Date.now());
        if (await this.sentOn(chatId, day))
            return;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:feishu:digest:${chatId}:${day}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
                return;
            try {
                if (await this.sentOn(chatId, day))
                    return;
                const text = await this.buildDigest(chat);
                if (await this.client.sendToChat(chatId, text)) {
                    await this.markSent(chatId, day);
                    core_1.Logger.info(`每日汇总已发送 chat=${chatId} day=${day}`, loggerCtx);
                }
            }
            finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
            }
        }
        finally {
            await runner.release();
        }
    }
    /** 汇总内容由指令服务统一生成：平台群走全平台，店铺群走单店 */
    buildDigest(chat) {
        return this.command.renderDigest(chat);
    }
    async ensureStateTable() {
        await this.connection.rawConnection.query(`CREATE TABLE IF NOT EXISTS "${DIGEST_TABLE}" ("chatId" varchar PRIMARY KEY, "sentDay" varchar NOT NULL, "sentAt" timestamp NOT NULL DEFAULT now())`);
    }
    async sentOn(chatId, day) {
        try {
            const rows = await this.connection.rawConnection.query(`SELECT "sentDay" FROM "${DIGEST_TABLE}" WHERE "chatId" = $1`, [chatId]);
            const row = Array.isArray(rows) ? rows[0] : undefined;
            return (row === null || row === void 0 ? void 0 : row.sentDay) === day;
        }
        catch (_a) {
            return false;
        }
    }
    async markSent(chatId, day) {
        await this.connection.rawConnection.query(`INSERT INTO "${DIGEST_TABLE}" ("chatId", "sentDay", "sentAt") VALUES ($1, $2, now())
             ON CONFLICT ("chatId") DO UPDATE SET "sentDay" = $2, "sentAt" = now()`, [chatId, day]);
    }
};
exports.FeishuDigestService = FeishuDigestService;
exports.FeishuDigestService = FeishuDigestService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_config_1.FeishuConfigService,
        feishu_client_1.FeishuClient,
        core_1.TransactionalConnection,
        feishu_command_service_1.FeishuCommandService])
], FeishuDigestService);
//# sourceMappingURL=feishu.digest.service.js.map