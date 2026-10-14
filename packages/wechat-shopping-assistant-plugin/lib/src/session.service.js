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
exports.SessionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const wechat_shopping_session_entity_1 = require("./entities/wechat-shopping-session.entity");
/**
 * 会话存储：openid 维度 upsert 最近一次搜索结果。
 * 为控制体量，写入时顺带清理过期会话（低频消息场景足够）。
 */
let SessionService = class SessionService {
    constructor(connection) {
        this.connection = connection;
    }
    async saveResults(openid, channelId, results, query, ttlMinutes) {
        const repo = this.connection.getRepository(wechat_shopping_session_entity_1.WechatShoppingSession);
        const expireAt = new Date(Date.now() + ttlMinutes * 60000);
        const existing = await repo.findOne({ where: { openid } });
        if (existing) {
            await repo.update(existing.id, { channelId, results, query, expireAt });
        }
        else {
            await repo.insert(repo.create({ openid, channelId, results, query, expireAt }));
        }
        // 轻量清理：仅当该用户更新时顺带清一次过期会话
        await repo.createQueryBuilder().delete().where('expireAt < :now', { now: new Date() }).execute();
    }
    /** 返回 null 表示无会话/已过期 */
    async getActive(openid) {
        const session = await this.connection.getRepository(wechat_shopping_session_entity_1.WechatShoppingSession).findOne({ where: { openid } });
        if (!session)
            return null;
        if (session.expireAt.getTime() < Date.now())
            return null;
        return session;
    }
    async clear(openid) {
        await this.connection.getRepository(wechat_shopping_session_entity_1.WechatShoppingSession).delete({ openid });
    }
    // ============ 聊天内补录状态机（手机号 → 收货地址） ============
    /** 确保存在会话行（无搜索记录时先建空会话），返回当前会话或 null */
    async ensureSession(openid, channelId, ttlMinutes) {
        const existing = await this.getActive(openid);
        if (existing)
            return existing;
        const repo = this.connection.getRepository(wechat_shopping_session_entity_1.WechatShoppingSession);
        const expireAt = new Date(Date.now() + ttlMinutes * 60000);
        await repo.insert(repo.create({ openid, channelId, results: [], query: null, expireAt }));
        return this.getActive(openid);
    }
    /** 写入补录状态与草稿；顺带续期会话（补录两步可能跨过原 TTL） */
    async setFlow(openid, state, draft, ttlMinutes) {
        const session = await this.connection.getRepository(wechat_shopping_session_entity_1.WechatShoppingSession).findOne({ where: { openid } });
        if (!session)
            return;
        await this.connection.getRepository(wechat_shopping_session_entity_1.WechatShoppingSession).update(session.id, {
            state,
            draft,
            expireAt: new Date(Date.now() + ttlMinutes * 60000),
        });
    }
    /** 清除补录状态（保留搜索结果，用户可直接重新回复编号下单） */
    async clearFlow(openid) {
        await this.setFlow(openid, null, null, 30);
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], SessionService);
//# sourceMappingURL=session.service.js.map