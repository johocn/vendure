import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';

import { CardProduct } from './types';
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
}
