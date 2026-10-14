import { TransactionalConnection } from '@vendure/core';
import { CardProduct } from './types';
import { WechatShoppingSession } from './entities/wechat-shopping-session.entity';
/**
 * 会话存储：openid 维度 upsert 最近一次搜索结果。
 * 为控制体量，写入时顺带清理过期会话（低频消息场景足够）。
 */
export declare class SessionService {
    private connection;
    constructor(connection: TransactionalConnection);
    saveResults(openid: string, channelId: string, results: CardProduct[], query: string, ttlMinutes: number): Promise<void>;
    /** 返回 null 表示无会话/已过期 */
    getActive(openid: string): Promise<WechatShoppingSession | null>;
    clear(openid: string): Promise<void>;
    /** 确保存在会话行（无搜索记录时先建空会话），返回当前会话或 null */
    ensureSession(openid: string, channelId: string, ttlMinutes: number): Promise<WechatShoppingSession | null>;
    /** 写入补录状态与草稿；顺带续期会话（补录两步可能跨过原 TTL） */
    setFlow(openid: string, state: 'awaiting_phone' | 'awaiting_address' | null, draft: {
        phone?: string | null;
        indices?: number[];
    } | null, ttlMinutes: number): Promise<void>;
    /** 清除补录状态（保留搜索结果，用户可直接重新回复编号下单） */
    clearFlow(openid: string): Promise<void>;
}
