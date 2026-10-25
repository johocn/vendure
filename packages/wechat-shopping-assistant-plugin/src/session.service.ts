import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';

import { CardProduct, AssistantFlowDraft, AssistantFlowState } from './types';
import { WechatShoppingSession } from './entities/wechat-shopping-session.entity';

/**
 * 会话存储：openid 维度 upsert 最近一次搜索结果。
 * 为控制体量，写入时顺带清理过期会话（低频消息场景足够）。
 */
@Injectable()
export class SessionService {
    constructor(private connection: TransactionalConnection) {}

    async saveResults(openid: string, channelId: string, results: CardProduct[], query: string, ttlMinutes: number): Promise<void> {
        const repo = this.connection.getRepository(WechatShoppingSession);
        const expireAt = new Date(Date.now() + ttlMinutes * 60_000);
        const existing = await repo.findOne({ where: { openid } });
        if (existing) {
            await repo.update(existing.id, { channelId, results, query, expireAt });
        } else {
            await repo.insert(repo.create({ openid, channelId, results, query, expireAt }));
        }
        // 轻量清理：仅当该用户更新时顺带清一次过期会话
        await repo.createQueryBuilder().delete().where('expireAt < :now', { now: new Date() }).execute();
    }

    /** 返回 null 表示无会话/已过期 */
    async getActive(openid: string): Promise<WechatShoppingSession | null> {
        const session = await this.connection.getRepository(WechatShoppingSession).findOne({ where: { openid } });
        if (!session) return null;
        if (session.expireAt.getTime() < Date.now()) return null;
        return session;
    }

    async clear(openid: string): Promise<void> {
        await this.connection.getRepository(WechatShoppingSession).delete({ openid });
    }

    // ============ 聊天内补录状态机（手机号 → 收货地址） ============

    /** 确保存在会话行（无搜索记录时先建空会话），返回当前会话或 null */
    async ensureSession(openid: string, channelId: string, ttlMinutes: number): Promise<WechatShoppingSession | null> {
        const existing = await this.getActive(openid);
        if (existing) return existing;
        const repo = this.connection.getRepository(WechatShoppingSession);
        const expireAt = new Date(Date.now() + ttlMinutes * 60_000);
        await repo.insert(repo.create({ openid, channelId, results: [], query: null, expireAt }));
        return this.getActive(openid);
    }

    /** 写入状态机状态与草稿；顺带续期会话（多轮对话可能跨过原 TTL） */
    async setFlow(
        openid: string,
        state: AssistantFlowState,
        draft: AssistantFlowDraft | null,
        ttlMinutes: number,
    ): Promise<void> {
        const session = await this.connection.getRepository(WechatShoppingSession).findOne({ where: { openid } });
        if (!session) return;
        await this.connection.getRepository(WechatShoppingSession).update(session.id, {
            state,
            draft,
            expireAt: new Date(Date.now() + ttlMinutes * 60_000),
        });
    }

    /** 清除补录状态（保留搜索结果，用户可直接重新回复编号下单） */
    async clearFlow(openid: string): Promise<void> {
        await this.setFlow(openid, null, null, 30);
    }

    /**
     * 只合并草稿并续期，不改变状态：
     * 空闲态收到位置消息时缓存定位结果（供后续「新增地址」直接使用），不打断当前流程。
     */
    async saveDraft(openid: string, patch: AssistantFlowDraft, ttlMinutes: number): Promise<void> {
        const repo = this.connection.getRepository(WechatShoppingSession);
        const session = await repo.findOne({ where: { openid } });
        if (!session) return;
        await repo.update(session.id, {
            draft: { ...(session.draft ?? {}), ...patch },
            expireAt: new Date(Date.now() + ttlMinutes * 60_000),
        });
    }
}
