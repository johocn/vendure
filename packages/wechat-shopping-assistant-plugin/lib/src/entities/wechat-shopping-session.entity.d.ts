import { DeepPartial, VendureEntity } from '@vendure/core';
import { CardProduct } from '../types';
/**
 * 微信购物助手会话：openid 维度保存最近一次搜索结果（编号 → 商品）。
 * 用户回复「买N」时按编号回查本表下单；过期需重新搜索。
 */
export declare class WechatShoppingSession extends VendureEntity {
    constructor(input?: DeepPartial<WechatShoppingSession>);
    /** 用户 openid（公众号） */
    openid: string;
    /** 下单目标渠道 id（字符串，与 meili 文档 channelId 一致） */
    channelId: string;
    /** 最近一次搜索结果（含会话序号），simple-json 存储 */
    results: CardProduct[];
    /** 原始查询词（会话过期引导重搜时展示） */
    query: string | null;
    /** 会话过期时间；type: Date 构造器让 typeorm 按方言推断（postgres→timestamp / sqlite→datetime，显式 'datetime' 不被 postgres 支持） */
    expireAt: Date;
}
